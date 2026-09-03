jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
  InjectDataSource: () => () => undefined,
  getRepositoryToken: (entity: unknown) => entity,
  TypeOrmModule: { forFeature: () => ({}), forRoot: () => ({}) },
}));

import type { DataSource } from 'typeorm';
import { FormEntity, FormStatus } from '../database/entities/form.entity';
import { FormVersionEntity } from '../database/entities/form-version.entity';
import { OrganizationEntity } from '../database/entities/organization.entity';
import {
  PublicationEntity,
  PublicationType,
} from '../database/entities/publication.entity';
import {
  ResponseEntity,
  ResponseStatus,
} from '../database/entities/response.entity';
import { WorkspaceEntity } from '../database/entities/workspace.entity';
import { createTestDataSource } from '../testing/test-database';
import { ExportService } from './export.service';

describe('ExportService — خروجی گزارش', () => {
  let ds: DataSource;
  let service: ExportService;
  let formId: string;

  beforeEach(async () => {
    ds = await createTestDataSource();
    service = new ExportService(
      ds.getRepository(ResponseEntity),
      ds.getRepository(FormVersionEntity),
    );

    const org = await ds
      .getRepository(OrganizationEntity)
      .save({ name: 'سازمان' });
    const workspace = await ds
      .getRepository(WorkspaceEntity)
      .save({ organizationId: org.id, name: 'فضا' });
    const form = await ds.getRepository(FormEntity).save({
      workspaceId: workspace.id,
      title: 'فرم',
      slug: `f-${Date.now()}`,
      status: FormStatus.ACTIVE,
      settings: {},
    });
    formId = form.id;

    const version = await ds.getRepository(FormVersionEntity).save({
      formId: form.id,
      version: 1,
      structure: {
        pages: [
          {
            id: 'p1',
            questions: [
              { id: 'q1', type: 'short_text', title: 'نام شما' },
              { id: 'q2', type: 'nps', title: 'امتیاز' },
              // سوالی که هیچ‌کس جواب نداده هم باید ستون داشته باشد.
              { id: 'q3', type: 'long_text', title: 'بی‌پاسخ' },
            ],
          },
        ],
        scoreIndexes: [{ id: 'i1', key: 'satisfaction', title: 'رضایت' }],
      },
    });

    const publication = await ds.getRepository(PublicationEntity).save({
      formId: form.id,
      type: PublicationType.LINK,
      token: `tok-${Date.now()}`,
      isActive: true,
    });

    await ds.getRepository(ResponseEntity).save({
      formVersionId: version.id,
      publicationId: publication.id,
      respondentKey: 'user-1',
      status: ResponseStatus.COMPLETED,
      startedAt: new Date(),
      submittedAt: new Date('2026-09-01T10:00:00Z'),
      durationSeconds: 42,
      meta: { ip: '1.2.3.4', userAgent: 'Firefox' },
      answers: { q1: 'مریم', q2: 9 },
      scores: { satisfaction: 9 },
    });
  });

  afterEach(async () => {
    await ds.destroy();
  });

  describe('ستون‌ها', () => {
    it('ستون‌ها را از ساختار فرم می‌سازد نه از پاسخ‌ها', async () => {
      const columns = await service.buildColumns(formId, false);
      const headers = columns.map((c) => c.header);

      expect(headers).toContain('نام شما');
      // سوال بی‌پاسخ هم ستون دارد.
      expect(headers).toContain('بی‌پاسخ');
      expect(headers).toContain('شاخص رضایت');
    });

    it('در حالت ساده متادیتا نمی‌آورد', async () => {
      const headers = (await service.buildColumns(formId, false)).map(
        (c) => c.header,
      );
      expect(headers).not.toContain('IP');
    });

    it('در حالت پیشرفته متادیتا را می‌آورد', async () => {
      const headers = (await service.buildColumns(formId, true)).map(
        (c) => c.header,
      );
      expect(headers).toContain('IP');
      expect(headers).toContain('مدت پاسخ (ثانیه)');
    });
  });

  describe('CSV', () => {
    it('سرستون و داده را می‌نویسد', async () => {
      const csv = await service.toCsv(formId, false);

      expect(csv).toContain('نام شما');
      expect(csv).toContain('مریم');
      expect(csv).toContain('تکمیل‌شده');
    });

    it('با BOM شروع می‌شود تا اکسل فارسی را درست باز کند', async () => {
      const csv = await service.toCsv(formId, false);
      expect(csv.charCodeAt(0)).toBe(0xfeff);
    });

    it('مقدار دارای ویرگول را نقل‌قول می‌کند', async () => {
      await ds
        .getRepository(ResponseEntity)
        .update(
          { respondentKey: 'user-1' },
          { answers: { q1: 'مریم, رضایی' } },
        );

      const csv = await service.toCsv(formId, false);
      expect(csv).toContain('"مریم, رضایی"');
    });

    it('متادیتا فقط در حالت پیشرفته می‌آید', async () => {
      expect(await service.toCsv(formId, false)).not.toContain('1.2.3.4');
      expect(await service.toCsv(formId, true)).toContain('1.2.3.4');
    });
  });

  describe('اکسل', () => {
    it('فایل معتبر xlsx می‌سازد', async () => {
      const buffer = await service.toExcel(formId, false);

      expect(buffer.length).toBeGreaterThan(1000);
      // فایل xlsx یک زیپ است و با PK شروع می‌شود.
      expect(buffer.subarray(0, 2).toString()).toBe('PK');
    });

    it('برای فرم بدون پاسخ هم فایل می‌سازد', async () => {
      await ds
        .getRepository(ResponseEntity)
        .delete({ respondentKey: 'user-1' });
      const buffer = await service.toExcel(formId, false);
      expect(buffer.length).toBeGreaterThan(1000);
    });
  });
});
