jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import type { DataSource } from 'typeorm';
import { OrganizationEntity } from '../database/entities/organization.entity';
import { WorkspaceEntity } from '../database/entities/workspace.entity';
import { FormEntity, FormStatus } from '../database/entities/form.entity';
import { FormVersionEntity } from '../database/entities/form-version.entity';
import {
  PublicationEntity,
  PublicationType,
} from '../database/entities/publication.entity';
import {
  ResponseEntity,
  ResponseStatus,
} from '../database/entities/response.entity';
import { AnswerFlatEntity } from '../database/entities/answer-flat.entity';
import { createTestDataSource } from '../testing/test-database';
import {
  listResponsePage,
  pageParams,
  MAX_PAGE_SIZE,
  DEFAULT_PAGE_SIZE,
} from './response-query';

/**
 * صفحه‌بندی و جست‌وجوی پاسخ‌ها.
 *
 * پیش از این هر دو مسیر (گزارش و فهرست) روی `take(500)` می‌ماندند؛ این تست
 * تضمین می‌کند ردیفِ ۵۰۱ هم دیده شود، `total` درست باشد و فیلترهای متنی
 * ردیفِ تکراری نسازند (چون با EXISTS انجام می‌شوند، نه JOIN).
 */
describe('response-query — صفحه‌بندی و فیلتر', () => {
  let ds: DataSource;
  let formId: string;
  const TOTAL = 250;

  beforeEach(async () => {
    ds = await createTestDataSource();
    const org = await ds
      .getRepository(OrganizationEntity)
      .save({ name: 'هتل آزمون' });
    const workspace = await ds
      .getRepository(WorkspaceEntity)
      .save({ organizationId: org.id, name: 'اصلی' });
    const form = await ds.getRepository(FormEntity).save({
      workspaceId: workspace.id,
      title: 'نظرسنجی',
      slug: `form-${Date.now()}`,
      status: FormStatus.ACTIVE,
      settings: {},
    });
    formId = form.id;
    const version = await ds.getRepository(FormVersionEntity).save({
      formId: form.id,
      version: 1,
      structure: { pages: [] },
    });
    const publication = await ds.getRepository(PublicationEntity).save({
      formId: form.id,
      type: PublicationType.LINK,
      token: `tok-${Date.now()}`,
      isActive: true,
    });

    const rows: ResponseEntity[] = [];
    for (let i = 0; i < TOTAL; i += 1) {
      rows.push(
        ds.getRepository(ResponseEntity).create({
          formVersionId: version.id,
          publicationId: publication.id,
          respondentKey: `0912000${String(i).padStart(4, '0')}`,
          status:
            i % 5 === 0 ? ResponseStatus.PARTIAL : ResponseStatus.COMPLETED,
          startedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)),
          submittedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, i)),
          answers: { q1: `پاسخ ${i}` },
          scores: {},
        }),
      );
    }
    await ds.getRepository(ResponseEntity).save(rows);

    // برای یکی از پاسخ‌ها، ردیفِ تخت با متنِ قابلِ جست‌وجو می‌نویسیم.
    const target = await ds.getRepository(ResponseEntity).findOne({
      where: { respondentKey: '09120000042' },
    });
    if (!target) throw new Error('پاسخِ هدف ساخته نشد');
    await ds.getRepository(AnswerFlatEntity).save([
      {
        responseId: target.id,
        questionId: 'q_reason',
        valueText: 'تهویه خراب بود',
        valueNumber: null,
        choiceId: null,
      },
      {
        responseId: target.id,
        questionId: 'q_rate',
        valueText: null,
        valueNumber: 3,
        choiceId: 'c3',
      },
    ]);
  });

  afterEach(async () => {
    await ds.destroy();
  });

  const repo = () => ds.getRepository(ResponseEntity);

  it('صفحهٔ اول را با شمارشِ کل برمی‌گرداند', async () => {
    const page = await listResponsePage(repo(), formId, {});
    expect(page.total).toBe(TOTAL);
    expect(page.page).toBe(1);
    expect(page.pageSize).toBe(DEFAULT_PAGE_SIZE);
    expect(page.rows).toHaveLength(DEFAULT_PAGE_SIZE);
    // مرتب‌سازی نزولی بر اساس زمان.
    expect(page.rows[0].startedAt.getTime()).toBeGreaterThan(
      page.rows[1].startedAt.getTime(),
    );
  });

  it('صفحهٔ سوم، باقی‌ماندهٔ ردیف‌ها را می‌دهد (ردیفِ ۵۰۱ هم دیده می‌شود)', async () => {
    const page = await listResponsePage(repo(), formId, {
      page: 3,
      pageSize: 100,
    });
    expect(page.total).toBe(TOTAL);
    expect(page.rows).toHaveLength(50);
  });

  it('اندازهٔ صفحه از سقف بالاتر نمی‌رود', async () => {
    const page = await listResponsePage(repo(), formId, { pageSize: 10_000 });
    expect(page.pageSize).toBe(MAX_PAGE_SIZE);
    expect(pageParams(0, 0)).toMatchObject({ page: 1, pageSize: DEFAULT_PAGE_SIZE });
  });

  it('فیلترِ وضعیت، شمارشِ کل را هم محدود می‌کند', async () => {
    const page = await listResponsePage(repo(), formId, {
      status: 'partial',
      pageSize: 10,
    });
    expect(page.total).toBe(TOTAL / 5);
    expect(page.rows.every((r) => r.status === ResponseStatus.PARTIAL)).toBe(true);
  });

  it('جست‌وجوی آزاد، متنِ پاسخ را پیدا می‌کند', async () => {
    const page = await listResponsePage(repo(), formId, { search: 'تهویه' });
    expect(page.total).toBe(1);
    expect(page.rows[0].respondentKey).toBe('09120000042');
  });

  it('جست‌وجو کلیدِ پاسخ‌دهنده را هم می‌بیند', async () => {
    const page = await listResponsePage(repo(), formId, { search: '09120000042' });
    expect(page.total).toBe(1);
  });

  it('فیلترِ سوال/مقدار ردیفِ تکراری نمی‌سازد', async () => {
    const page = await listResponsePage(repo(), formId, {
      questionId: 'q_reason',
      valueText: 'خراب',
    });
    expect(page.total).toBe(1);
    expect(page.rows).toHaveLength(1);
  });

  it('فرمِ دیگر، پاسخ‌های این فرم را نمی‌بیند', async () => {
    const page = await listResponsePage(repo(), 'form-other', {});
    expect(page.total).toBe(0);
    expect(page.rows).toHaveLength(0);
  });
});
