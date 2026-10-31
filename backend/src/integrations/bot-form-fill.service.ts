import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { BotFormSessionEntity } from '../database/entities/bot-form-session.entity';
import { FormVersionEntity } from '../database/entities/form-version.entity';
import { PublicService } from '../public/public.service';
import { jalaliToIso } from '../common/jalali';

/** یک سوالِ ساده‌شده‌ی فرم، همان‌قدر که گفتگوی ربات لازم دارد. */
export interface BotQuestion {
  id: string;
  type: string;
  title: string;
  description?: string;
  required?: boolean;
  options?: string[];
  meta?: Record<string, unknown>;
}

/**
 * نوع‌هایی که در گفتگوی متنیِ ربات قابل پاسخ‌اند.
 *
 * بیرون از این فهرست (آپلودِ فایل، دوربین، صدا، امضا، موقعیت، انتخابِ تصویری،
 * ماتریس، اولویت‌بندی) چیزی لازم دارد که پیام متنی نمی‌دهد؛ آن فرم‌ها با
 * مینی‌اپ باز می‌شوند، نه داخلِ گفتگو.
 */
const BOT_ANSWERABLE = new Set([
  'short_text',
  'long_text',
  'number',
  'email',
  'url',
  'phone',
  'mobile',
  'date',
  'boolean',
  'multiple_choice',
  'dropdown',
  'emoji',
  'rating',
  'nps',
  'slider',
  'static_text',
]);

const BTN_CANCEL = '✖️ لغوِ فرم';
const BTN_SKIP = '⏭ رد کردن';

/** پاسخِ ربات: متن + کیبوردِ اختیاری (هم‌شکلِ BotReply در staff-bot). */
interface Reply {
  text: string;
  keyboard?: Record<string, unknown>;
}

/**
 * آیا این فرم را می‌شود کاملاً داخلِ ربات پر کرد؟
 *
 * دو شرط: همه‌ی سوال‌ها نوعِ متنی/دکمه‌ای داشته باشند، و فرم منطقِ شرطی
 * (پرش/نمایش) نداشته باشد — گفتگوی ربات سوال‌ها را پشتِ‌سرهم می‌پرسد و
 * موتورِ منطق را اجرا نمی‌کند، پس فرمِ شرطی باید با مینی‌اپ باز شود تا
 * پاسخ‌دهنده سوالِ نامربوط نبیند.
 */
export function isBotFillable(
  questions: BotQuestion[],
  logic?: Record<string, unknown> | null,
): boolean {
  if (questions.length === 0) return false;
  if (!questions.every((q) => BOT_ANSWERABLE.has(q.type))) return false;

  const hasRules = (key: string) =>
    Array.isArray((logic ?? {})[key]) &&
    ((logic ?? {})[key] as unknown[]).length > 0;
  return !hasRules('skip') && !hasRules('display');
}

/** ارقامِ فارسی/عربی را به لاتین برمی‌گرداند. */
function toLatinDigits(input: string): string {
  return input.replace(/[۰-۹٠-٩]/g, (d) =>
    String(
      d.charCodeAt(0) >= 0x06f0
        ? d.charCodeAt(0) - 0x06f0
        : d.charCodeAt(0) - 0x0660,
    ),
  );
}

/**
 * پر کردنِ فرم داخلِ گفتگوی ربات.
 *
 * وبهوک فقط رویدادِ `message` می‌گیرد (نه callback دکمه‌های شیشه‌ای)، پس همه‌ی
 * تعامل با کیبوردِ پاسخ (متن) انجام می‌شود: هر دکمه یک پیامِ متنی می‌فرستد.
 */
@Injectable()
export class BotFormFillService {
  private readonly logger = new Logger(BotFormFillService.name);

  constructor(
    @InjectRepository(BotFormSessionEntity)
    private readonly sessions: Repository<BotFormSessionEntity>,
    @InjectRepository(FormVersionEntity)
    private readonly versions: Repository<FormVersionEntity>,
    @Inject(forwardRef(() => PublicService))
    private readonly publicService: PublicService,
    private readonly jwt: JwtService,
  ) {}

  /** گفتگوی نیمه‌کاره‌ی این چت، اگر باشد. */
  findSession(chatId: string, platform: string) {
    return this.sessions.findOne({ where: { chatId, platform } });
  }

  /** سوال‌های مسطحِ آخرین نسخه‌ی فرم + منطقِ آن. */
  async structureOf(formId: string): Promise<{
    questions: BotQuestion[];
    logic: Record<string, unknown> | null;
  }> {
    const version = await this.versions.findOne({
      where: { formId },
      order: { version: 'DESC' },
    });
    const structure = (version?.structure ?? {}) as {
      pages?: Array<{ questions?: BotQuestion[] }>;
      logic?: Record<string, unknown>;
    };
    const questions = (structure.pages ?? []).flatMap((p) => p.questions ?? []);
    return { questions, logic: structure.logic ?? null };
  }

  /** شروعِ پر کردنِ یک فرم؛ سوالِ اول را برمی‌گرداند. */
  async start(input: {
    chatId: string;
    platform: string;
    formId: string;
    publicationId: string;
    respondentKey: string;
    formTitle: string;
  }): Promise<Reply> {
    const { questions } = await this.structureOf(input.formId);
    if (questions.length === 0) return { text: 'این فرم سوالی ندارد.' };

    // هر گفتگو یک فرمِ نیمه‌کاره دارد؛ شروعِ تازه جایگزینِ قبلی می‌شود.
    await this.sessions.delete({
      chatId: input.chatId,
      platform: input.platform,
    });
    await this.sessions.save(
      this.sessions.create({
        chatId: input.chatId,
        platform: input.platform,
        formId: input.formId,
        publicationId: input.publicationId,
        respondentKey: input.respondentKey,
        questionIndex: 0,
        answers: {},
      }),
    );

    const first = await this.advanceOverStaticText(
      input.chatId,
      input.platform,
      questions,
      0,
      {},
    );
    return {
      text: `📝 <b>${input.formTitle}</b>\nبرای توقف، «${BTN_CANCEL}» را بزنید.\n\n${first.text}`,
      keyboard: first.keyboard,
    };
  }

  /**
   * پیامِ کاربر را به‌عنوانِ پاسخِ سوالِ جاری می‌گیرد.
   *
   * `null` یعنی این چت گفتگوی بازی ندارد و پیام باید به منوی عادی برود.
   */
  async handleMessage(
    chatId: string,
    platform: string,
    text: string,
  ): Promise<Reply | null> {
    const session = await this.findSession(chatId, platform);
    if (!session) return null;

    const trimmed = text.trim();
    if (trimmed === BTN_CANCEL || trimmed === '/لغو' || trimmed === '/cancel') {
      await this.sessions.delete({ id: session.id });
      return { text: '✖️ پر کردنِ فرم لغو شد.', keyboard: { remove_keyboard: true } };
    }

    const { questions } = await this.structureOf(session.formId);
    const question = questions[session.questionIndex];
    if (!question) {
      await this.sessions.delete({ id: session.id });
      return { text: 'این فرم دیگر در دسترس نیست.' };
    }

    const answers = { ...(session.answers ?? {}) };

    // رد کردنِ سوالِ غیراجباری.
    if (trimmed === BTN_SKIP) {
      if (question.required) {
        const again = this.prompt(question);
        return {
          text: `این سوال اجباری است.\n\n${again.text}`,
          keyboard: again.keyboard,
        };
      }
    } else {
      const parsed = this.parse(question, trimmed);
      if ('error' in parsed) {
        const again = this.prompt(question);
        return {
          text: `${parsed.error}\n\n${again.text}`,
          keyboard: again.keyboard,
        };
      }
      answers[question.id] = parsed.value;
    }

    const next = await this.advanceOverStaticText(
      chatId,
      platform,
      questions,
      session.questionIndex + 1,
      answers,
    );
    return next;
  }

  /**
   * سوالِ بعدی را آماده می‌کند و «متنِ ثابت» را خودکار رد می‌کند.
   *
   * اگر سوالی نماند، فرم ثبت می‌شود.
   */
  private async advanceOverStaticText(
    chatId: string,
    platform: string,
    questions: BotQuestion[],
    startIndex: number,
    answers: Record<string, unknown>,
  ): Promise<Reply> {
    let index = startIndex;
    const notes: string[] = [];
    // «متنِ ثابت» پاسخ نمی‌خواهد؛ متنش نشان داده و از آن رد می‌شویم.
    while (index < questions.length && questions[index].type === 'static_text') {
      notes.push(questions[index].title);
      index += 1;
    }

    if (index >= questions.length) {
      const done = await this.submit(chatId, platform, answers);
      return {
        text: [...notes, done].filter(Boolean).join('\n\n'),
        keyboard: { remove_keyboard: true },
      };
    }

    await this.sessions.update(
      { chatId, platform },
      // TypeORM برای ستونِ JSON نوعِ «عمیقاً جزئی» می‌خواهد؛ شیءِ ما همان است.
      { questionIndex: index, answers: answers as never },
    );
    const ask = this.prompt(questions[index]);
    const counter = `سوال ${index + 1} از ${questions.length}`;
    return {
      text: [...notes, `${counter}\n${ask.text}`].filter(Boolean).join('\n\n'),
      keyboard: ask.keyboard,
    };
  }

  /** متن و کیبوردِ یک سوال. */
  private prompt(q: BotQuestion): Reply {
    const required = q.required ? ' <b>*</b>' : '';
    const head = `${q.title}${required}`;
    const desc = q.description ? `\n<i>${q.description}</i>` : '';
    const rows: Array<Array<{ text: string }>> = [];
    let hint = '';

    const choices = (q.options ?? []).filter(Boolean);
    if (q.type === 'boolean') {
      rows.push([{ text: 'بله' }, { text: 'خیر' }]);
    } else if (
      (q.type === 'multiple_choice' ||
        q.type === 'dropdown' ||
        q.type === 'emoji') &&
      choices.length > 0
    ) {
      // هر ردیف دو گزینه تا دکمه‌ها در موبایل خوانا بمانند.
      for (let i = 0; i < choices.length; i += 2) {
        rows.push(choices.slice(i, i + 2).map((c) => ({ text: c })));
      }
      if (q.meta?.multiple === true) {
        hint = '\n(چند گزینه را با ویرگول جدا کنید)';
      }
    } else if (q.type === 'rating' || q.type === 'nps' || q.type === 'slider') {
      const { min, max } = this.range(q);
      hint = `\n(عددی بین ${min} تا ${max})`;
      if (max - min <= 10) {
        const nums: Array<{ text: string }> = [];
        for (let n = min; n <= max; n += 1) nums.push({ text: String(n) });
        for (let i = 0; i < nums.length; i += 5) rows.push(nums.slice(i, i + 5));
      }
    } else if (q.type === 'date') {
      hint = '\n(به شکلِ ۱۴۰۴/۰۵/۱۲)';
    } else if (q.type === 'mobile') {
      hint = '\n(مثلاً ۰۹۱۲۳۴۵۶۷۸۹)';
    }

    if (!q.required) rows.push([{ text: BTN_SKIP }]);
    rows.push([{ text: BTN_CANCEL }]);

    return {
      text: `${head}${desc}${hint}`,
      keyboard: { keyboard: rows, resize_keyboard: true },
    };
  }

  /** بازه‌ی سوال‌های امتیازی. */
  private range(q: BotQuestion): { min: number; max: number } {
    if (q.type === 'nps') return { min: 0, max: 10 };
    const meta = q.meta ?? {};
    const min = Number(meta.min ?? (q.type === 'rating' ? 1 : 0));
    const max = Number(meta.max ?? (q.type === 'rating' ? 5 : 10));
    return { min, max };
  }

  /** متنِ کاربر را به مقدارِ سوال تبدیل می‌کند یا خطای فارسی می‌دهد. */
  private parse(
    q: BotQuestion,
    raw: string,
  ): { value: unknown } | { error: string } {
    const text = raw.trim();
    if (!text) return { error: 'پاسخ خالی است.' };

    switch (q.type) {
      case 'boolean': {
        if (['بله', 'آره', 'yes', 'y'].includes(text.toLowerCase()))
          return { value: 'yes' };
        if (['خیر', 'نه', 'no', 'n'].includes(text.toLowerCase()))
          return { value: 'no' };
        return { error: 'لطفاً «بله» یا «خیر» را انتخاب کنید.' };
      }
      case 'multiple_choice':
      case 'dropdown':
      case 'emoji': {
        const options = (q.options ?? []).filter(Boolean);
        if (options.length === 0) return { value: text };
        if (q.meta?.multiple === true) {
          const picked = text
            .split(/[،,]/)
            .map((s) => s.trim())
            .filter(Boolean);
          const bad = picked.find((p) => !options.includes(p));
          if (bad) return { error: `گزینه‌ی «${bad}» در فهرست نیست.` };
          return { value: picked };
        }
        if (!options.includes(text)) {
          return { error: 'لطفاً یکی از گزینه‌های روی کیبورد را بزنید.' };
        }
        return { value: text };
      }
      case 'number':
      case 'rating':
      case 'nps':
      case 'slider': {
        const n = Number(toLatinDigits(text));
        if (!Number.isFinite(n)) return { error: 'لطفاً یک عدد بفرستید.' };
        if (q.type !== 'number') {
          const { min, max } = this.range(q);
          if (n < min || n > max) {
            return { error: `عدد باید بین ${min} تا ${max} باشد.` };
          }
        }
        return { value: n };
      }
      case 'email': {
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(text))
          return { error: 'ایمیل معتبر نیست.' };
        return { value: text };
      }
      case 'url': {
        if (!/^https?:\/\/\S+$/i.test(text))
          return { error: 'نشانی باید با http:// یا https:// شروع شود.' };
        return { value: text };
      }
      case 'mobile':
      case 'phone': {
        const digits = toLatinDigits(text).replace(/\D/g, '');
        const min = q.type === 'mobile' ? 10 : 8;
        if (digits.length < min) return { error: 'شماره معتبر نیست.' };
        return { value: digits };
      }
      case 'date': {
        const parts = toLatinDigits(text).split(/[\/\-.]/).map((p) => p.trim());
        if (parts.length === 3) {
          const [y, m, d] = parts.map(Number);
          if ([y, m, d].every(Number.isFinite)) {
            // سالِ چهاررقمیِ کمتر از ۱۷۰۰ یعنی شمسی.
            if (y < 1700) return { value: jalaliToIso(y, m, d) };
            const iso = new Date(Date.UTC(y, m - 1, d));
            if (!Number.isNaN(iso.getTime()))
              return { value: iso.toISOString().slice(0, 10) };
          }
        }
        return { error: 'تاریخ را به شکلِ ۱۴۰۴/۰۵/۱۲ بفرستید.' };
      }
      default:
        return { value: text };
    }
  }

  /** ثبتِ نهاییِ پاسخ از مسیرِ عمومی، با هویتِ همان پرسنل. */
  private async submit(
    chatId: string,
    platform: string,
    answers: Record<string, unknown>,
  ): Promise<string> {
    const session = await this.findSession(chatId, platform);
    if (!session) return 'گفتگو پیدا نشد.';

    try {
      /*
       * همان توکنِ هویتِ مینی‌اپ: `public` کلیدِ پاسخ‌دهنده را از آن می‌گیرد،
       * پس پاسخ به نامِ خودِ پرسنل در «درخواست‌های من» و گردش‌کار می‌نشیند.
       */
      const accessToken = this.jwt.sign(
        {
          publicationId: session.publicationId,
          respondentKey: session.respondentKey,
          mode: 'bot',
        },
        { expiresIn: 600 },
      );
      const publicToken = await this.publicTokenOf(session.publicationId);
      if (!publicToken) return '❌ لینکِ این فرم پیدا نشد.';

      await this.publicService.submitByToken(
        publicToken,
        { answers, meta: { source: 'bot' } } as never,
        accessToken,
        { ip: null },
      );
      await this.sessions.delete({ id: session.id });
      return '✅ فرم ثبت شد. وضعیتش را در «📋 درخواست‌های من» دنبال کنید.';
    } catch (error) {
      await this.sessions.delete({ id: session.id });
      const message = (error as { response?: { message?: string } })?.response
        ?.message;
      this.logger.warn(`ثبتِ فرمِ ربات ناموفق بود: ${(error as Error).message}`);
      return `❌ ثبتِ فرم ناموفق بود: ${message ?? (error as Error).message}`;
    }
  }

  /** توکنِ عمومیِ یک انتشار (برای مسیرِ ثبتِ پاسخ). */
  private async publicTokenOf(publicationId: string): Promise<string | null> {
    const row = await this.sessions.manager
      .createQueryBuilder()
      .select('p.token', 'token')
      .addSelect('p.slug', 'slug')
      .from('publications', 'p')
      .where('p.id = :id', { id: publicationId })
      .getRawOne<{ token: string; slug: string | null }>();
    return row?.slug ?? row?.token ?? null;
  }
}
