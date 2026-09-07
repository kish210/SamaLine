import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResponseEntity } from '../database/entities/response.entity';
import { FormVersionEntity } from '../database/entities/form-version.entity';
import type {
  FormQuestionNode,
  FormStructure,
  ScoreIndexNode,
} from '../forms/logic-types';
import { isoToJalaliText } from '../common/jalali';
import { extractKeywords, type Keyword } from './keywords';

/** یک ستون نمودار. */
export interface AnalyticsBar {
  label: string;
  count: number;
  percent: number;
}

export interface AnalyticsQuestion {
  id: string;
  title: string;
  type: string;
  /** چند نفر به این سوال پاسخ داده‌اند. */
  answered: number;
  /** چند نفر رد کرده‌اند (پاسخ‌دهنده‌هایی که سوال برایشان نمایش داده شده). */
  skipped: number;
  /** نحوه‌ی نمایش پیشنهادی در پنل. */
  chart: 'bar' | 'scale' | 'nps' | 'text' | 'none';
  bars: AnalyticsBar[];
  average: number | null;
  /** برای سوال‌های مقیاسی: کف و سقف مقیاس، تا نمودار درست کشیده شود. */
  scale: { min: number; max: number } | null;
  nps: {
    promoters: number;
    passives: number;
    detractors: number;
    score: number;
  } | null;
  /** نمونه‌ی پاسخ‌های متنی؛ برای مرور سریع بدون باز کردن جدول. */
  samples: string[];
  /** پرتکرارترین کلیدواژه‌های پاسخ‌های متنی. */
  keywords: Keyword[];
}

export interface AnalyticsResult {
  /** بازه‌ی اعمال‌شده؛ برای نوشتن روی سربرگ گزارش چاپی. */
  range: {
    from: string | null;
    to: string | null;
    fromJalali: string | null;
    toJalali: string | null;
  };
  questions: AnalyticsQuestion[];
  trend: Array<{
    date: string;
    jalali: string;
    started: number;
    completed: number;
  }>;
  scores: Array<{
    key: string;
    average: number;
    count: number;
    maxScore: number | null;
    /** میانگین به‌صورت درصدی از سقف؛ بدون سقف null. */
    rate: number | null;
  }>;
  totalResponses: number;
}

/** نوع‌هایی که پاسخشان متن آزاد است و نمودار میله‌ای برایشان بی‌معنی است. */
const TEXT_TYPES = new Set([
  'short_text',
  'long_text',
  'email',
  'url',
  'phone',
  'mobile',
  'location',
]);

/** نوع‌هایی که اصلا داده‌ی قابل تجمیع ندارند. */
const OPAQUE_TYPES = new Set([
  'static_text',
  'file_upload',
  'camera',
  'audio_record',
  'signature',
]);

const SCALE_TYPES = new Set(['rating', 'slider', 'number']);

const CHOICE_TYPES = new Set([
  'multiple_choice',
  'dropdown',
  'boolean',
  'image_choice',
  'emoji',
  'ranking',
]);

const BOOLEAN_LABELS: Record<string, string> = {
  yes: 'بله',
  no: 'خیر',
  true: 'بله',
  false: 'خیر',
};

/**
 * تجمیع پاسخ‌ها برای گزارش‌های تصویری.
 *
 * مبنا عمداً `response.answers` است نه جدول `answer_flat`: جدول تخت شناسه‌ی
 * سوال را بدون فرم نگه می‌دارد، پس دو فرم که از یک قالب ساخته شده‌اند
 * شناسه‌ی مشترک دارند و آمارشان با هم قاطی می‌شد. اینجا از راه نسخه‌ی فرم
 * محدود می‌شویم و این اشتباه ممکن نیست.
 */
@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(ResponseEntity)
    private readonly responseRepo: Repository<ResponseEntity>,
    @InjectRepository(FormVersionEntity)
    private readonly versionRepo: Repository<FormVersionEntity>,
  ) {}

  /**
   * @param range بازه‌ی زمانی میلادی (`YYYY-MM-DD`). `to` شامل خودِ آن روز
   *   است؛ کاربری که «تا ۳۱ شهریور» می‌گوید انتظار دارد پاسخ‌های همان روز
   *   هم بیایند.
   */
  async forForm(
    formId: string,
    range: { from?: string; to?: string } = {},
  ): Promise<AnalyticsResult> {
    const version = await this.versionRepo.findOne({
      where: { formId },
      order: { version: 'DESC' },
    });
    if (!version) throw new NotFoundException('نسخه فرم یافت نشد');

    const structure = version.structure as unknown as FormStructure;
    const questions = (structure.pages ?? []).flatMap((p) => p.questions ?? []);

    const query = this.responseRepo
      .createQueryBuilder('response')
      .innerJoin('response.formVersion', 'version')
      .where('version.formId = :formId', { formId });

    if (range.from) {
      query.andWhere('response.createdAt >= :from', {
        from: new Date(`${range.from}T00:00:00.000Z`),
      });
    }
    if (range.to) {
      query.andWhere('response.createdAt <= :to', {
        to: new Date(`${range.to}T23:59:59.999Z`),
      });
    }

    const responses = await query
      .orderBy('response.createdAt', 'ASC')
      .getMany();

    const completed = responses.filter((r) => r.status === 'completed');

    return {
      range: {
        from: range.from ?? null,
        to: range.to ?? null,
        fromJalali: range.from ? isoToJalaliText(range.from) : null,
        toJalali: range.to ? isoToJalaliText(range.to) : null,
      },
      totalResponses: completed.length,
      questions: questions
        .map((q) => this.aggregate(q, completed))
        .filter((q) => q.chart !== 'none'),
      trend: this.trend(responses),
      scores: this.scores(structure.scoreIndexes ?? [], completed),
    };
  }

  private aggregate(
    question: FormQuestionNode,
    responses: ResponseEntity[],
  ): AnalyticsQuestion {
    const type = question.type ?? 'short_text';
    const base: AnalyticsQuestion = {
      id: question.id,
      title: question.title ?? question.id,
      type,
      answered: 0,
      skipped: 0,
      chart: 'none',
      bars: [],
      average: null,
      scale: null,
      nps: null,
      samples: [],
      keywords: [],
    };

    if (OPAQUE_TYPES.has(type)) return base;

    const values = responses
      .map((r) => r.answers?.[question.id])
      .filter((v) => v !== undefined && v !== null && v !== '');

    base.answered = values.length;
    base.skipped = responses.length - values.length;
    if (values.length === 0) {
      // بدون پاسخ هم سوال باید در فهرست بماند، وگرنه گزارش ناقص به نظر می‌رسد.
      base.chart = TEXT_TYPES.has(type)
        ? 'text'
        : type === 'nps'
          ? 'nps'
          : SCALE_TYPES.has(type) || type === 'date'
            ? 'scale'
            : 'bar';
      if (type === 'date') base.chart = 'bar';
      return base;
    }

    if (type === 'nps') {
      return this.npsQuestion(base, values);
    }

    if (SCALE_TYPES.has(type)) {
      return this.scaleQuestion(base, question, values);
    }

    if (type === 'matrix') {
      return this.matrixQuestion(base, values);
    }

    if (type === 'date') {
      base.chart = 'bar';
      base.bars = this.toBars(
        values.map((v) => isoToJalaliText(String(v)) || String(v)),
        values.length,
      );
      return base;
    }

    if (CHOICE_TYPES.has(type)) {
      base.chart = 'bar';
      const labels: string[] = [];
      for (const value of values) {
        for (const item of Array.isArray(value) ? value : [value]) {
          labels.push(this.choiceLabel(String(item), type));
        }
      }
      base.bars = this.toBars(labels, values.length);
      return base;
    }

    base.chart = 'text';
    base.samples = values.slice(-20).map((v) => String(v)).reverse();
    /*
     * کلیدواژه فقط از متن آزاد گرفته می‌شود.
     *
     * شماره تلفن و ایمیل هم «متنی» شمرده می‌شوند ولی شمردن واژه‌هایشان
     * چیزی جز فهرستی از تکه‌های شماره نمی‌دهد. کلیدواژه هم از همه‌ی
     * پاسخ‌ها می‌آید، نه فقط ۲۰ تای نمایش‌داده‌شده.
     */
    if (type === 'short_text' || type === 'long_text') {
      base.keywords = extractKeywords(values.map((v) => String(v)));
    }
    return base;
  }

  /** برچسب خوانا برای یک گزینه‌ی ذخیره‌شده. */
  private choiceLabel(raw: string, type: string): string {
    if (type === 'boolean') return BOOLEAN_LABELS[raw] ?? raw;
    // گزینه‌های تصویری به شکل «نشانی|برچسب» ذخیره می‌شوند.
    if (type === 'image_choice' && raw.includes('|')) {
      return raw.slice(raw.indexOf('|') + 1) || raw;
    }
    return raw;
  }

  private npsQuestion(
    base: AnalyticsQuestion,
    values: unknown[],
  ): AnalyticsQuestion {
    const numbers = this.numbers(values);
    if (numbers.length === 0) return { ...base, chart: 'nps' };

    const promoters = numbers.filter((n) => n >= 9).length;
    const detractors = numbers.filter((n) => n <= 6).length;
    const passives = numbers.length - promoters - detractors;

    return {
      ...base,
      chart: 'nps',
      scale: { min: 0, max: 10 },
      average: round(numbers.reduce((a, b) => a + b, 0) / numbers.length),
      nps: {
        promoters,
        passives,
        detractors,
        score: round(((promoters - detractors) / numbers.length) * 100),
      },
      bars: this.toBars(
        numbers.map((n) => String(n)),
        numbers.length,
      ).sort((a, b) => Number(a.label) - Number(b.label)),
    };
  }

  private scaleQuestion(
    base: AnalyticsQuestion,
    question: FormQuestionNode,
    values: unknown[],
  ): AnalyticsQuestion {
    const numbers = this.numbers(values);
    if (numbers.length === 0) return { ...base, chart: 'scale' };

    const meta = (question.meta ?? {}) as { min?: number; max?: number };
    const min = Number.isFinite(meta.min) ? Number(meta.min) : Math.min(...numbers);
    const max = Number.isFinite(meta.max) ? Number(meta.max) : Math.max(...numbers);

    return {
      ...base,
      chart: 'scale',
      scale: { min, max },
      average: round(numbers.reduce((a, b) => a + b, 0) / numbers.length),
      bars: this.toBars(
        numbers.map((n) => String(n)),
        numbers.length,
      ).sort((a, b) => Number(a.label) - Number(b.label)),
    };
  }

  /**
   * ماتریس: هر سطر یک پاسخ دارد، پس تجمیع روی «سطر → ستون» انجام می‌شود و
   * خروجی به شکل «سطر: ستون» تخت می‌شود تا با همان نمودار میله‌ای نشان داده شود.
   */
  private matrixQuestion(
    base: AnalyticsQuestion,
    values: unknown[],
  ): AnalyticsQuestion {
    const labels: string[] = [];
    for (const value of values) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        for (const [row, col] of Object.entries(
          value as Record<string, unknown>,
        )) {
          if (col === undefined || col === null || col === '') continue;
          labels.push(`${row}: ${String(col)}`);
        }
      }
    }
    return { ...base, chart: 'bar', bars: this.toBars(labels, values.length) };
  }

  private numbers(values: unknown[]): number[] {
    return values
      .map((v) => (typeof v === 'number' ? v : Number(v)))
      .filter((n) => Number.isFinite(n));
  }

  private toBars(labels: string[], total: number): AnalyticsBar[] {
    const counts = new Map<string, number>();
    for (const label of labels) {
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    const denominator = total || 1;
    return [...counts.entries()]
      .map(([label, count]) => ({
        label,
        count,
        percent: round((count / denominator) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  }

  /** روند روزانه‌ی پاسخ‌ها با تاریخ شمسی برای محور نمودار. */
  private trend(responses: ResponseEntity[]) {
    const days = new Map<string, { started: number; completed: number }>();
    for (const response of responses) {
      const date = toIsoDay(response.createdAt);
      const bucket = days.get(date) ?? { started: 0, completed: 0 };
      bucket.started += 1;
      if (response.status === 'completed') bucket.completed += 1;
      days.set(date, bucket);
    }

    return [...days.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, counts]) => ({
        date,
        jalali: isoToJalaliText(date),
        ...counts,
      }));
  }

  private scores(indexes: ScoreIndexNode[], responses: ResponseEntity[]) {
    return indexes.map((index) => {
      const values = responses
        .map((r) => Number((r.scores ?? {})[index.key]))
        .filter((n) => Number.isFinite(n));
      const average = values.length
        ? values.reduce((a, b) => a + b, 0) / values.length
        : 0;
      const max = index.maxScore ?? 0;
      return {
        key: index.title ?? index.key,
        count: values.length,
        average: round(average),
        maxScore: max || null,
        /**
         * «نرخ شاخص»: میانگین به‌صورت درصدی از سقف.
         *
         * بدون سقف معنا ندارد — میانگین ۷ روی مقیاس ۱۰ با میانگین ۷ روی
         * مقیاس ۱۰۰ یکی نیست — پس با سقف تعریف‌نشده null برمی‌گردد و پنل
         * به‌جای عدد گمراه‌کننده، خط تیره نشان می‌دهد.
         */
        rate: max > 0 ? round((average / max) * 100) : null,
      };
    });
  }
}

function round(value: number): number {
  return Number(value.toFixed(2));
}

function toIsoDay(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
