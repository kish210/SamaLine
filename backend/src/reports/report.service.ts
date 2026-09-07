import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnswerFlatEntity } from '../database/entities/answer-flat.entity';
import { ResponseEntity } from '../database/entities/response.entity';
import { SavedFilterEntity } from '../database/entities/saved-filter.entity';
import { PublicationEntity } from '../database/entities/publication.entity';
import { ReportResponseFilterDto, SaveFilterDto } from './dto';
import { LIKE_OPERATOR } from '../database/column-types';

@Injectable()
export class ReportService {
  constructor(
    @InjectRepository(ResponseEntity)
    private readonly responseRepo: Repository<ResponseEntity>,
    @InjectRepository(AnswerFlatEntity)
    private readonly answerFlatRepo: Repository<AnswerFlatEntity>,
    @InjectRepository(SavedFilterEntity)
    private readonly savedFilterRepo: Repository<SavedFilterEntity>,
    @InjectRepository(PublicationEntity)
    private readonly publicationRepo: Repository<PublicationEntity>,
  ) {}

  /**
   * شاخص‌های کلی یک فرم.
   *
   * «بازدید» از شمارنده‌ی انتشار می‌آید نه از تعداد پاسخ؛ پیش از این این
   * دو یکی گرفته می‌شدند و نرخ پاسخگویی همیشه صد درصد درمی‌آمد.
   */
  async formSummary(formId: string) {
    const base = () =>
      this.responseRepo
        .createQueryBuilder('response')
        .innerJoin('response.formVersion', 'version')
        .where('version.formId = :formId', { formId });

    const started = await base().getCount();
    const completed = await base()
      .andWhere("response.status = 'completed'")
      .getCount();

    const { total } = (await this.publicationRepo
      .createQueryBuilder('publication')
      .select('COALESCE(SUM(publication.viewCount), 0)', 'total')
      .where('publication.formId = :formId', { formId })
      .getRawOne<{ total: string }>()) ?? { total: '0' };

    const views = Number(total) || 0;

    const { avg } = (await base()
      .andWhere("response.status = 'completed'")
      .andWhere('response.durationSeconds IS NOT NULL')
      .select('AVG(response.durationSeconds)', 'avg')
      .getRawOne<{ avg: string | null }>()) ?? { avg: null };

    const percent = (part: number, whole: number) =>
      whole > 0 ? Number(((part / whole) * 100).toFixed(2)) : 0;

    return {
      views,
      started,
      completed,
      /** چند درصد از بازدیدها به پاسخ کامل رسیده‌اند. */
      responseRate: percent(completed, views),
      /** چند درصد از شروع‌کننده‌ها تا آخر رفته‌اند. */
      completionRate: percent(completed, started),
      /** میانگین زمان پاسخ‌دهی بر حسب ثانیه. */
      averageDurationSeconds:
        avg === null ? null : Number(Number(avg).toFixed(1)),
    };
  }

  /** پاسخ‌های تکمیل‌شده‌ی یک فرم؛ مبنای محاسبه‌ی میانگین شاخص‌ها. */
  completedResponses(formId: string) {
    return this.responseRepo
      .createQueryBuilder('response')
      .innerJoin('response.formVersion', 'version')
      .where('version.formId = :formId', { formId })
      .andWhere("response.status = 'completed'")
      .getMany();
  }

  /**
   * شمارش پاسخ‌های یک سوال.
   *
   * `formId` اختیاری است ولی باید داده شود: شناسه‌ی سوال بین فرم‌هایی که از
   * یک قالب ساخته شده‌اند مشترک است، پس بدون آن آمار چند فرم با هم جمع می‌شد.
   */
  async questionBreakdown(questionId: string, formId?: string) {
    const query = this.answerFlatRepo
      .createQueryBuilder('answer')
      .where('answer.questionId = :questionId', { questionId })
      .take(5000);

    if (formId) {
      query
        .innerJoin('answer.response', 'response')
        .innerJoin('response.formVersion', 'version')
        .andWhere('version.formId = :formId', { formId });
    }

    const values = await query.getMany();
    const counts = values.reduce<Record<string, number>>((acc, row) => {
      const key = row.choiceId ?? row.valueText ?? 'خالی';
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  }

  async filteredResponses(formId: string, filter: ReportResponseFilterDto) {
    const qb = this.responseRepo
      .createQueryBuilder('response')
      .innerJoin('response.formVersion', 'formVersion')
      .where('formVersion.formId = :formId', { formId });

    if (filter.status) {
      qb.andWhere('response.status = :status', { status: filter.status });
    }

    if (filter.respondentKey) {
      qb.andWhere('response.respondentKey = :respondentKey', {
        respondentKey: filter.respondentKey,
      });
    }

    if (filter.dateFrom) {
      qb.andWhere('response.createdAt >= :dateFrom', {
        dateFrom: filter.dateFrom,
      });
    }

    if (filter.dateTo) {
      qb.andWhere('response.createdAt <= :dateTo', { dateTo: filter.dateTo });
    }

    if (filter.questionId || filter.valueText) {
      qb.innerJoin('response.answerFlat', 'answerFlat');
      if (filter.questionId) {
        qb.andWhere('answerFlat.questionId = :questionId', {
          questionId: filter.questionId,
        });
      }
      if (filter.valueText) {
        qb.andWhere(`answerFlat.valueText ${LIKE_OPERATOR} :valueText`, {
          valueText: `%${filter.valueText}%`,
        });
      }
    }

    return qb.orderBy('response.createdAt', 'DESC').take(500).getMany();
  }

  saveFilter(dto: SaveFilterDto) {
    return this.savedFilterRepo.save(this.savedFilterRepo.create(dto));
  }

  listFilters(workspaceId: string) {
    return this.savedFilterRepo.find({
      where: { workspaceId },
      order: { createdAt: 'DESC' },
    });
  }

  async deleteFilter(id: string) {
    await this.savedFilterRepo.delete({ id });
    return { ok: true };
  }
}
