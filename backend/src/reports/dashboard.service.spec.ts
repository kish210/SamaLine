jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
  InjectDataSource: () => () => undefined,
  getRepositoryToken: (entity: unknown) => entity,
  TypeOrmModule: { forFeature: () => ({}), forRoot: () => ({}) },
}));

import type { DataSource } from 'typeorm';
import { AnswerFlatEntity } from '../database/entities/answer-flat.entity';
import { DashboardEntity } from '../database/entities/dashboard.entity';
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
import { DashboardService, computeNps } from './dashboard.service';
import { ReportService } from './report.service';

describe('computeNps', () => {
  it('ترویج‌کننده منهای مخالف را درصد می‌کند', () => {
    // ۲ ترویج‌کننده (۹،۱۰)، ۱ خنثی (۷)، ۱ مخالف (۳) از ۴ نفر → ۲۵٪
    expect(
      computeNps([
        { label: '10', count: 1 },
        { label: '9', count: 1 },
        { label: '7', count: 1 },
        { label: '3', count: 1 },
      ]),
    ).toBe(25);
  });

  it('برچسب غیرعددی را نادیده می‌گیرد', () => {
    expect(
      computeNps([
        { label: '10', count: 1 },
        { label: 'خالی', count: 5 },
      ]),
    ).toBe(100);
  });

  it('بدون داده صفر می‌دهد', () => {
    expect(computeNps([])).toBe(0);
  });
});

describe('DashboardService — داشبوردساز', () => {
  let ds: DataSource;
  let service: DashboardService;
  let organizationId: string;
  let otherOrganizationId: string;
  let formId: string;
  let foreignFormId: string;

  const seedForm = async (orgId: string) => {
    const workspace = await ds
      .getRepository(WorkspaceEntity)
      .save({ organizationId: orgId, name: 'فضا' });
    const form = await ds.getRepository(FormEntity).save({
      workspaceId: workspace.id,
      title: 'فرم',
      slug: `f-${Math.random().toString(36).slice(2)}`,
      status: FormStatus.ACTIVE,
      settings: {},
    });
    const version = await ds
      .getRepository(FormVersionEntity)
      .save({ formId: form.id, version: 1, structure: {} });
    const publication = await ds.getRepository(PublicationEntity).save({
      formId: form.id,
      type: PublicationType.LINK,
      token: `t-${Math.random().toString(36).slice(2)}`,
      isActive: true,
    });
    return { form, version, publication };
  };

  beforeEach(async () => {
    ds = await createTestDataSource();

    const orgRepo = ds.getRepository(OrganizationEntity);
    organizationId = (await orgRepo.save({ name: 'الف' })).id;
    otherOrganizationId = (await orgRepo.save({ name: 'ب' })).id;

    const own = await seedForm(organizationId);
    formId = own.form.id;
    foreignFormId = (await seedForm(otherOrganizationId)).form.id;

    // دو پاسخ تکمیل‌شده با شاخص، برای ویجت آماری و شاخص
    for (const score of [4, 8]) {
      await ds.getRepository(ResponseEntity).save({
        formVersionId: own.version.id,
        publicationId: own.publication.id,
        status: ResponseStatus.COMPLETED,
        startedAt: new Date(),
        submittedAt: new Date(),
        answers: { q1: String(score) },
        scores: { sat: score },
        meta: {},
      });
    }

    const reports = new ReportService(
      ds.getRepository(ResponseEntity),
      ds.getRepository(AnswerFlatEntity),
      ds.getRepository(SavedFilterEntity),
      ds.getRepository(PublicationEntity),
    );

    service = new DashboardService(
      ds.getRepository(DashboardEntity),
      ds.getRepository(FormEntity),
      ds.getRepository(WorkspaceEntity),
      reports,
    );
  });

  afterEach(async () => {
    await ds.destroy();
  });

  const layout = { x: 0, y: 0, w: 4, h: 2 };

  describe('جداسازی مستاجر', () => {
    it('داشبورد سازمان دیگر قابل خواندن نیست', async () => {
      const dashboard = await service.create(organizationId, 'من');
      await expect(
        service.get(otherOrganizationId, dashboard.id),
      ).rejects.toThrow('داشبورد یافت نشد');
    });

    it('ویجت نمی‌تواند به فرم سازمان دیگر اشاره کند', async () => {
      const dashboard = await service.create(organizationId, 'من');

      await expect(
        service.update(organizationId, dashboard.id, {
          widgets: [
            {
              id: 'w1',
              type: 'stat',
              title: 'دزدی',
              formId: foreignFormId,
              metric: 'completed',
              layout,
            },
          ],
        }),
      ).rejects.toThrow('ویجت به فرمی خارج از سازمان شما اشاره می‌کند');
    });

    it('ویجت با فرم خودی پذیرفته می‌شود', async () => {
      const dashboard = await service.create(organizationId, 'من');
      const updated = await service.update(organizationId, dashboard.id, {
        widgets: [
          {
            id: 'w1',
            type: 'stat',
            title: 'تکمیل‌شده',
            formId,
            metric: 'completed',
            layout,
          },
        ],
      });

      expect(updated.widgets).toHaveLength(1);
    });
  });

  describe('محاسبه‌ی ویجت‌ها', () => {
    const withWidgets = async (
      widgets: Parameters<typeof service.update>[2]['widgets'],
    ) => {
      const dashboard = await service.create(organizationId, 'داشبورد');
      await service.update(organizationId, dashboard.id, { widgets });
      return service.render(organizationId, dashboard.id);
    };

    it('ویجت آماری مقدار درست می‌دهد', async () => {
      const result = await withWidgets([
        {
          id: 'w1',
          type: 'stat',
          title: 'تکمیل‌شده',
          formId,
          metric: 'completed',
          layout,
        },
      ]);

      expect(result.widgets[0].value).toBe(2);
    });

    it('ویجت شاخص میانگین را می‌دهد', async () => {
      const result = await withWidgets([
        {
          id: 'w1',
          type: 'score',
          title: 'رضایت',
          formId,
          scoreKey: 'sat',
          layout,
        },
      ]);

      // میانگین ۴ و ۸
      expect(result.widgets[0].value).toBe(6);
    });

    it('ویجت متنی محتوا را برمی‌گرداند', async () => {
      const result = await withWidgets([
        { id: 'w1', type: 'text', title: 'یادداشت', content: 'سلام', layout },
      ]);

      expect(result.widgets[0].content).toBe('سلام');
    });

    it('ویجت جدول پاسخ‌های اخیر را با شناسه می‌دهد', async () => {
      const result = await withWidgets([
        { id: 'w1', type: 'table', title: 'پاسخ‌های اخیر', formId, layout },
      ]);

      const rows = result.widgets[0].rows ?? [];
      expect(rows).toHaveLength(2);
      // شناسه‌ی پاسخ لازم است تا بشود به خودِ پاسخ رفت (drill-down).
      expect(rows[0].responseId).toBeTruthy();
      expect(rows[0].score).toBeGreaterThan(0);
    });

    it('ویجت جدول به سقفِ ردیف احترام می‌گذارد', async () => {
      const result = await withWidgets([
        {
          id: 'w1',
          type: 'table',
          title: 'یک ردیف',
          formId,
          limit: 1,
          layout,
        },
      ]);

      expect(result.widgets[0].rows).toHaveLength(1);
    });

    it('ویجت نظرها فقط پاسخ‌های متنیِ همان سوال را می‌آورد', async () => {
      const result = await withWidgets([
        {
          id: 'w1',
          type: 'verbatim',
          title: 'نظرها',
          formId,
          questionId: 'q1',
          layout,
        },
      ]);

      const quotes = result.widgets[0].quotes ?? [];
      expect(quotes).toHaveLength(2);
      expect(quotes[0].text).toMatch(/4|8/);
      expect(quotes[0].responseId).toBeTruthy();
    });

    it('ویجت نظرها بدونِ سوال خطا می‌دهد', async () => {
      const result = await withWidgets([
        { id: 'w1', type: 'verbatim', title: 'نظرها', formId, layout },
      ]);

      expect(result.widgets[0].error).toContain('سوال');
    });

    it('ویجت روند سری زمانی و تعداد کل می‌دهد', async () => {
      const result = await withWidgets([
        { id: 'w1', type: 'trend', title: 'روند', formId, layout },
      ]);

      const w = result.widgets[0];
      expect(w.value).toBe(2);
      expect((w.series ?? []).length).toBeGreaterThanOrEqual(1);
    });

    it('بازه‌ی زمانی پاسخ‌های بیرون از بازه را کنار می‌گذارد', async () => {
      const dashboard = await service.create(organizationId, 'داشبورد');
      await service.update(organizationId, dashboard.id, {
        widgets: [
          { id: 'w1', type: 'table', title: 'جدول', formId, layout },
        ],
      });

      // بازه‌ای در گذشته که هیچ پاسخی در آن نیست.
      const past = await service.render(organizationId, dashboard.id, {
        from: '2020-01-01',
        to: '2020-01-31',
      });
      expect(past.widgets[0].rows).toHaveLength(0);

      // بدونِ بازه همه‌ی پاسخ‌ها می‌آیند.
      const all = await service.render(organizationId, dashboard.id);
      expect(all.widgets[0].rows).toHaveLength(2);
    });

    it('ویجت ناقص خطا می‌دهد ولی بقیه را خراب نمی‌کند', async () => {
      const result = await withWidgets([
        {
          id: 'w1',
          type: 'stat',
          title: 'بدون فرم',
          metric: 'completed',
          layout,
        },
        {
          id: 'w2',
          type: 'text',
          title: 'سالم',
          content: 'کار می‌کند',
          layout,
        },
      ]);

      expect(result.widgets[0].error).toBe('فرم انتخاب نشده است');
      expect(result.widgets[1].content).toBe('کار می‌کند');
    });
  });

  describe('اشتراک عمومی', () => {
    it('با روشن کردن، توکن می‌سازد و نمای عمومی کار می‌کند', async () => {
      const dashboard = await service.create(organizationId, 'عمومی');
      await service.update(organizationId, dashboard.id, {
        widgets: [
          { id: 'w1', type: 'text', title: 'سلام', content: 'متن', layout },
        ],
      });

      const shared = await service.setPublic(
        organizationId,
        dashboard.id,
        true,
      );
      expect(shared.publicToken).toBeTruthy();

      const publicView = await service.renderPublic(shared.publicToken!);
      expect(publicView.widgets[0].content).toBe('متن');
    });

    it('با خاموش کردن، لینک عمومی از کار می‌افتد', async () => {
      const dashboard = await service.create(organizationId, 'عمومی');
      const shared = await service.setPublic(
        organizationId,
        dashboard.id,
        true,
      );
      const token = shared.publicToken!;

      await service.setPublic(organizationId, dashboard.id, false);

      await expect(service.renderPublic(token)).rejects.toThrow(
        'داشبورد عمومی یافت نشد',
      );
    });

    it('روشن کردن دوباره، توکن تازه می‌سازد', async () => {
      const dashboard = await service.create(organizationId, 'عمومی');
      const first = await service.setPublic(organizationId, dashboard.id, true);
      await service.setPublic(organizationId, dashboard.id, false);
      const second = await service.setPublic(
        organizationId,
        dashboard.id,
        true,
      );

      expect(second.publicToken).not.toBe(first.publicToken);
      // لینک قدیمی که جایی درز کرده دیگر کار نمی‌کند.
      await expect(service.renderPublic(first.publicToken!)).rejects.toThrow();
    });

    it('توکن ناموجود را رد می‌کند', async () => {
      await expect(service.renderPublic('نامعتبر')).rejects.toThrow(
        'داشبورد عمومی یافت نشد',
      );
    });
  });
});
