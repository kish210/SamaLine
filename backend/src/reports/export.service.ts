import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as ExcelJS from 'exceljs';
import { Repository } from 'typeorm';
import { FormVersionEntity } from '../database/entities/form-version.entity';
import { ResponseEntity } from '../database/entities/response.entity';
import type { FormStructure } from '../forms/logic-types';

export interface ExportColumn {
  key: string;
  header: string;
}

/**
 * خروجی گزارش پاسخ‌ها (بند ۸ سند).
 *
 * سرستون‌ها از ساختار فرم می‌آید نه از کلید پاسخ‌ها، تا ستون سوالی که
 * هیچ‌کس جواب نداده هم در خروجی بیاید و ترتیب ستون‌ها ثابت بماند.
 */
@Injectable()
export class ExportService {
  constructor(
    @InjectRepository(ResponseEntity)
    private readonly responseRepo: Repository<ResponseEntity>,
    @InjectRepository(FormVersionEntity)
    private readonly versionRepo: Repository<FormVersionEntity>,
  ) {}

  /** ستون‌های خروجی از روی آخرین نسخه‌ی ساختار فرم. */
  async buildColumns(formId: string, advanced: boolean) {
    const version = await this.versionRepo.findOne({
      where: { formId },
      order: { version: 'DESC' },
    });

    const structure = (version?.structure ?? {}) as FormStructure;
    const questionColumns: ExportColumn[] = (structure.pages ?? []).flatMap(
      (page) =>
        (page.questions ?? []).map((question) => ({
          key: `answer:${question.id}`,
          header: String(question.title ?? question.id),
        })),
    );

    const scoreColumns: ExportColumn[] = (structure.scoreIndexes ?? []).map(
      (index) => ({
        key: `score:${index.key}`,
        header: `شاخص ${index.title ?? index.key}`,
      }),
    );

    const base: ExportColumn[] = [
      { key: 'respondentKey', header: 'شناسه پاسخ‌دهنده' },
      { key: 'status', header: 'وضعیت' },
      { key: 'submittedAt', header: 'زمان ثبت' },
    ];

    // خروجی پیشرفته متادیتا را هم می‌آورد (بند ۸ سند).
    const meta: ExportColumn[] = advanced
      ? [
          { key: 'durationSeconds', header: 'مدت پاسخ (ثانیه)' },
          { key: 'meta:ip', header: 'IP' },
          { key: 'meta:userAgent', header: 'مرورگر' },
          { key: 'meta:params', header: 'پارامترهای مخفی' },
        ]
      : [];

    return [...base, ...questionColumns, ...scoreColumns, ...meta];
  }

  async buildRows(formId: string, columns: ExportColumn[]) {
    const responses = await this.responseRepo.find({
      where: { formVersion: { formId } },
      relations: { formVersion: true },
      order: { createdAt: 'DESC' },
    });

    return responses.map((response) =>
      columns.map((column) => this.cellValue(response, column.key)),
    );
  }

  /** خروجی CSV با BOM تا اکسل فارسی را درست باز کند. */
  async toCsv(formId: string, advanced: boolean) {
    const columns = await this.buildColumns(formId, advanced);
    const rows = await this.buildRows(formId, columns);

    const escape = (value: string) =>
      /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

    const lines = [
      columns.map((c) => escape(c.header)).join(','),
      ...rows.map((row) => row.map((cell) => escape(cell)).join(',')),
    ];

    // BOM به‌صورت کد نویسه نوشته می‌شود تا در سورس نامرئی نباشد.
    const BOM = '﻿';
    return BOM + lines.join('\r\n');
  }

  async toExcel(formId: string, advanced: boolean): Promise<Buffer> {
    const columns = await this.buildColumns(formId, advanced);
    const rows = await this.buildRows(formId, columns);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SamaLine';
    const sheet = workbook.addWorksheet('پاسخ‌ها', {
      views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }],
    });

    sheet.addRow(columns.map((c) => c.header));
    sheet.getRow(1).font = { bold: true };
    rows.forEach((row) => sheet.addRow(row));

    sheet.columns.forEach((column, index) => {
      const headerLength = columns[index]?.header.length ?? 10;
      column.width = Math.min(40, Math.max(14, headerLength + 4));
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  private cellValue(response: ResponseEntity, key: string): string {
    if (key.startsWith('answer:')) {
      return this.stringify(response.answers?.[key.slice(7)]);
    }
    if (key.startsWith('score:')) {
      return this.stringify(response.scores?.[key.slice(6)]);
    }
    if (key.startsWith('meta:')) {
      return this.stringify(response.meta?.[key.slice(5)]);
    }

    switch (key) {
      case 'respondentKey':
        return response.respondentKey ?? '';
      case 'status':
        return String(response.status) === 'completed' ? 'تکمیل‌شده' : 'ناتمام';
      case 'submittedAt':
        return response.submittedAt
          ? new Date(response.submittedAt).toISOString()
          : '';
      case 'durationSeconds':
        return response.durationSeconds === null
          ? ''
          : String(response.durationSeconds);
      default:
        return '';
    }
  }

  private stringify(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (Array.isArray(value)) {
      return value.map((item) => this.stringify(item)).join('، ');
    }
    if (typeof value === 'object') return JSON.stringify(value);
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    return '';
  }
}
