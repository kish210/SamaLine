jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
  InjectDataSource: () => () => undefined,
  getRepositoryToken: (entity: unknown) => entity,
  TypeOrmModule: { forFeature: () => ({}), forRoot: () => ({}) },
}));

import type { DataSource } from 'typeorm';
import { AnswerFlatEntity } from '../database/entities/answer-flat.entity';
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
import { SavedFilterEntity } from '../database/entities/saved-filter.entity';
import { WorkspaceEntity } from '../database/entities/workspace.entity';
import { createTestDataSource } from '../testing/test-database';
import { ReportService } from './report.service';

describe('ReportService — شاخص‌های کلی فرم', () => {
  let ds: DataSource;
  let service: ReportService;
  let formId: string;
  let versionId: string;
  let publicationId: string;

  beforeEach(async () => {
    ds = await createTestDataSource();
    service = new ReportService(
      ds.getRepository(ResponseEntity),
      ds.getRepository(AnswerFlatEntity),
      ds.getRepository(SavedFilterEntity),
      ds.getRepository(PublicationEntity),
    );

    const organization = await ds
      .getRepository(OrganizationEntity)
      .save({ name: 'سازمان' });
    const workspace = await ds
      .getRepository(WorkspaceEntity)
      .save({ name: 'فضا', organizationId: organization.id });
    const form = await ds.getRepository(FormEntity).save({
      workspaceId: workspace.id,
      title: 'فرم',
      slug: `f-${Date.now()}`,
      status: FormStatus.DRAFT,
      settings: {},
    });
    formId = form.id;

    const version = await ds
      .getRepository(FormVersionEntity)
      .save({ formId: form.id, version: 1, structure: { pages: [] } });
    versionId = version.id;

    // هر پاسخ به یک انتشار وصل است؛ این انتشار پایه بازدید صفر دارد.
    const base = await publish(0);
    publicationId = base.id;
  });

  afterEach(async () => {
    await ds.destroy();
  });

  const publish = (viewCount: number) =>
    ds.getRepository(PublicationEntity).save({
      formId,
      type: PublicationType.LINK,
      token: `t-${Math.random().toString(36).slice(2)}`,
      config: {},
      tags: [],
      isActive: true,
      viewCount,
    });

  const respond = (status: ResponseStatus, durationSeconds?: number) =>
    ds.getRepository(ResponseEntity).save({
      publicationId,
      formVersionId: versionId,
      status,
      answers: {},
      scores: {},
      meta: {},
      durationSeconds: durationSeconds ?? null,
    });

  it('فرم بدون بازدید و پاسخ، همه‌چیز صفر است', async () => {
    const summary = await service.formSummary(formId);
    expect(summary).toMatchObject({
      views: 0,
      started: 0,
      completed: 0,
      responseRate: 0,
      completionRate: 0,
      averageDurationSeconds: null,
    });
  });

  it('بازدید از شمارنده‌ی انتشار می‌آید نه از تعداد پاسخ', async () => {
    /*
     * پیش از این «بازدید» با «تعداد پاسخ» یکی گرفته می‌شد و نرخ پاسخگویی
     * همیشه صد درصد درمی‌آمد؛ یعنی عددی که هیچ‌وقت چیزی نمی‌گفت.
     */
    await publish(100);
    await respond(ResponseStatus.COMPLETED);
    await respond(ResponseStatus.COMPLETED);

    const summary = await service.formSummary(formId);
    expect(summary.views).toBe(100);
    expect(summary.completed).toBe(2);
    expect(summary.responseRate).toBe(2);
  });

  it('بازدید چند انتشار با هم جمع می‌شود', async () => {
    await publish(30);
    await publish(70);
    expect((await service.formSummary(formId)).views).toBe(100);
  });

  it('نرخ تکمیل بر مبنای شروع‌کننده‌هاست نه بازدید', async () => {
    await publish(200);
    await respond(ResponseStatus.COMPLETED);
    await respond(ResponseStatus.PARTIAL);
    await respond(ResponseStatus.PARTIAL);

    const summary = await service.formSummary(formId);
    expect(summary.started).toBe(3);
    expect(summary.completionRate).toBe(33.33);
    expect(summary.responseRate).toBe(0.5);
  });

  it('میانگین زمان فقط از پاسخ‌های کامل و زمان‌دار حساب می‌شود', async () => {
    await publish(10);
    await respond(ResponseStatus.COMPLETED, 30);
    await respond(ResponseStatus.COMPLETED, 90);
    // ناقص و بدون زمان نباید در میانگین بیایند.
    await respond(ResponseStatus.PARTIAL, 1000);
    await respond(ResponseStatus.COMPLETED);

    expect((await service.formSummary(formId)).averageDurationSeconds).toBe(60);
  });

  it('نرخ پاسخگویی هیچ‌وقت از صد درصد بیشتر نمی‌شود', async () => {
    // شمارنده‌ی بازدید کم‌شماری می‌کند (پاسخ از حافظه‌ی نهان، ارسال مستقیم
    // از API، لینک پخش‌شده پیش از افزوده‌شدن شمارنده). با مخرجِ خامِ بازدید
    // نرخ ۱۵۰٪ درمی‌آمد — عددی که کل گزارش را بی‌اعتبار نشان می‌دهد.
    await publish(2);
    await respond(ResponseStatus.COMPLETED);
    await respond(ResponseStatus.COMPLETED);
    await respond(ResponseStatus.COMPLETED);

    const summary = await service.formSummary(formId);
    expect(summary.views).toBe(2);
    expect(summary.completed).toBe(3);
    expect(summary.responseRate).toBe(100);
  });

  it('بدون بازدید ولی با پاسخ، نرخ پاسخگویی بی‌نهایت نمی‌شود', async () => {
    // تقسیم بر صفر نباید NaN یا Infinity بدهد. با مخرجِ
    // max(بازدید، شروع‌شده) پاسخِ ثبت‌شده صد درصد شمرده می‌شود، نه صفر:
    // «صفر» عملا می‌گوید هیچ‌کس پاسخ نداده، که خلاف واقعیت است.
    await respond(ResponseStatus.COMPLETED);
    const summary = await service.formSummary(formId);
    expect(summary.responseRate).toBe(100);
    expect(Number.isFinite(summary.responseRate)).toBe(true);
  });
});
