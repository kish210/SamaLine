import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnswerFlatEntity } from '../database/entities/answer-flat.entity';
import { ResponseEntity } from '../database/entities/response.entity';
import { SavedFilterEntity } from '../database/entities/saved-filter.entity';
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
  ) {}

  async formSummary(formId: string) {
    const completed = await this.responseRepo
      .createQueryBuilder('response')
      .innerJoin('response.formVersion', 'version')
      .where('version.formId = :formId', { formId })
      .andWhere("response.status = 'completed'")
      .getCount();

    const started = await this.responseRepo
      .createQueryBuilder('response')
      .innerJoin('response.formVersion', 'version')
      .where('version.formId = :formId', { formId })
      .getCount();

    return {
      visits: started,
      started,
      completed,
      completionRate:
        started > 0 ? Number(((completed / started) * 100).toFixed(2)) : 0,
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

  async questionBreakdown(questionId: string) {
    const values = await this.answerFlatRepo.find({
      where: { questionId },
      take: 5000,
    });
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
