import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import ExcelJS from 'exceljs';
import { Repository } from 'typeorm';
import { FormEntity } from '../database/entities/form.entity';
import { ResponseCommentEntity } from '../database/entities/response-comment.entity';
import { ResponseEntity } from '../database/entities/response.entity';
import { CreateResponseCommentDto, ResponseFilterDto } from './dto';
import { LIKE_OPERATOR } from '../database/column-types';

@Injectable()
export class ResponseService {
  constructor(
    @InjectRepository(ResponseEntity)
    private readonly responseRepo: Repository<ResponseEntity>,
    @InjectRepository(FormEntity)
    private readonly formRepo: Repository<FormEntity>,
    @InjectRepository(ResponseCommentEntity)
    private readonly commentRepo: Repository<ResponseCommentEntity>,
  ) {}

  async listByForm(formId: string, filter?: ResponseFilterDto) {
    const qb = this.responseRepo
      .createQueryBuilder('response')
      .innerJoin('response.formVersion', 'formVersion')
      .where('formVersion.formId = :formId', { formId });

    if (filter?.status) {
      qb.andWhere('response.status = :status', { status: filter.status });
    }

    if (filter?.respondentKey) {
      qb.andWhere('response.respondentKey = :respondentKey', {
        respondentKey: filter.respondentKey,
      });
    }

    if (filter?.dateFrom) {
      qb.andWhere('response.createdAt >= :dateFrom', {
        dateFrom: filter.dateFrom,
      });
    }

    if (filter?.dateTo) {
      qb.andWhere('response.createdAt <= :dateTo', { dateTo: filter.dateTo });
    }

    if (filter?.questionId || filter?.valueText) {
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

  async exportByForm(formId: string) {
    const form = await this.formRepo.findOne({ where: { id: formId } });
    const responses = await this.listByForm(formId);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('responses');
    sheet.columns = [
      { header: 'response_id', key: 'id', width: 38 },
      { header: 'status', key: 'status', width: 14 },
      { header: 'respondent_key', key: 'respondentKey', width: 24 },
      { header: 'submitted_at', key: 'submittedAt', width: 26 },
      { header: 'answers_json', key: 'answers', width: 80 },
    ];

    responses.forEach((item) => {
      sheet.addRow({
        id: item.id,
        status: item.status,
        respondentKey: item.respondentKey ?? '',
        submittedAt: item.submittedAt?.toISOString() ?? '',
        answers: JSON.stringify(item.answers),
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return {
      filename: `${(form?.slug ?? formId).replace(/[^a-zA-Z0-9_-]/g, '-')}-responses.xlsx`,
      buffer: Buffer.from(buffer),
    };
  }

  getComments(responseId: string) {
    return this.commentRepo.find({
      where: { responseId },
      order: { createdAt: 'DESC' },
    });
  }

  async addComment(responseId: string, dto: CreateResponseCommentDto) {
    const response = await this.responseRepo.findOne({
      where: { id: responseId },
    });
    if (!response) {
      throw new NotFoundException('پاسخ مورد نظر یافت نشد');
    }

    return this.commentRepo.save(
      this.commentRepo.create({
        responseId,
        authorName: dto.authorName,
        body: dto.body,
      }),
    );
  }
}
