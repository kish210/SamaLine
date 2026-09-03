import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import ExcelJS from 'exceljs';
import { Repository } from 'typeorm';
import { FormEntity } from '../database/entities/form.entity';
import { ResponseEntity } from '../database/entities/response.entity';

@Injectable()
export class ResponseService {
  constructor(
    @InjectRepository(ResponseEntity) private readonly responseRepo: Repository<ResponseEntity>,
    @InjectRepository(FormEntity) private readonly formRepo: Repository<FormEntity>,
  ) {}

  async listByForm(formId: string) {
    return this.responseRepo
      .createQueryBuilder('response')
      .innerJoin('response.formVersion', 'formVersion')
      .where('formVersion.formId = :formId', { formId })
      .orderBy('response.createdAt', 'DESC')
      .getMany();
  }

  async exportByForm(formId: string) {
    const form = await this.formRepo.findOne({ where: { id: formId } });
    const responses = await this.listByForm(formId);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('responses');
    sheet.columns = [
      { header: 'response_id', key: 'id', width: 38 },
      { header: 'status', key: 'status', width: 14 },
      { header: 'submitted_at', key: 'submittedAt', width: 26 },
      { header: 'answers_json', key: 'answers', width: 80 },
    ];

    responses.forEach((item) => {
      sheet.addRow({
        id: item.id,
        status: item.status,
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
}
