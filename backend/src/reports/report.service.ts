import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnswerFlatEntity } from '../database/entities/answer-flat.entity';
import { ResponseEntity } from '../database/entities/response.entity';

@Injectable()
export class ReportService {
  constructor(
    @InjectRepository(ResponseEntity)
    private readonly responseRepo: Repository<ResponseEntity>,
    @InjectRepository(AnswerFlatEntity)
    private readonly answerFlatRepo: Repository<AnswerFlatEntity>,
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
}
