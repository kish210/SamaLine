// باید پیش از import سرویس‌ها اجرا شود (jest.mock بالا برده می‌شود).
jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
  InjectDataSource: () => () => undefined,
  getRepositoryToken: (entity: unknown) => entity,
  TypeOrmModule: { forFeature: () => ({}), forRoot: () => ({}) },
}));

// @nestjs/jwt هم خالص ESM است؛ در تست فقط امضا و بررسی لازم است.
jest.mock('@nestjs/jwt', () =>
  jest
    .requireActual<typeof import('../testing/jwt.mock')>('../testing/jwt.mock')
    .nestJwtModuleMock(),
);

import type { DataSource } from 'typeorm';
import { AnswerFlatEntity } from '../database/entities/answer-flat.entity';
import { FormEntity, FormStatus } from '../database/entities/form.entity';
import { FormVersionEntity } from '../database/entities/form-version.entity';
import { OrganizationEntity } from '../database/entities/organization.entity';
import {
  PlanCode,
  PlanPolicyEntity,
} from '../database/entities/plan-policy.entity';
import {
  PublicationEntity,
  PublicationType,
} from '../database/entities/publication.entity';
import {
  ResponseEntity,
  ResponseStatus,
} from '../database/entities/response.entity';
import { SubscriptionEntity } from '../database/entities/subscription.entity';
import { UsageCounterEntity } from '../database/entities/usage-counter.entity';
import { WorkspaceEntity } from '../database/entities/workspace.entity';
import { LogicEngineService } from '../forms/logic-engine.service';
import { LogicRuntimeService } from '../forms/logic-runtime.service';
import { ScoreEngineService } from '../forms/score-engine.service';
import { PlanService } from '../plans/plan.service';
import { createTestDataSource } from '../testing/test-database';
import { JwtService } from '@nestjs/jwt';
import { OtpChallengeEntity } from '../database/entities/otp-challenge.entity';
import type { MessagingService } from '../messaging/messaging.service';
import { PublicService } from './public.service';
import { RespondentAuthService } from './respondent-auth.service';
import { PlatformSettingsService } from '../platform/platform-settings.service';
import { PlatformSettingsEntity } from '../database/entities/platform-settings.entity';
import { UserEntity } from '../database/entities/user.entity';

/**
 * تست ادغام روی دیتابیس واقعی (SQLite در حافظه).
 * مسیر ثبت پاسخ حساس‌ترین بخش سامانه است: پول، سقف پلن، جلوگیری از
 * تکرار و صحت داده همه اینجا به هم می‌رسند.
 */
describe('PublicService — مسیر ثبت پاسخ', () => {
  let ds: DataSource;
  let service: PublicService;
  let respondentAuth: RespondentAuthService;
  let publicationToken: string;
  let organizationId: string;

  const structure = {
    pages: [
      {
        id: 'p1',
        questions: [
          { id: 'q1', type: 'boolean', title: 'استفاده کرده‌اید؟' },
          {
            id: 'rate',
            type: 'rating',
            title: 'امتیاز؟',
            scoring: { indexId: 'i1' },
          },
        ],
      },
      {
        id: 'p2',
        questions: [{ id: 'why', type: 'long_text', title: 'چرا؟' }],
      },
    ],
    logic: {
      display: [
        {
          targetQuestionId: 'why',
          when: {
            combinator: 'and',
            conditions: [
              { source: 'score.satisfaction', operator: 'lt', value: 5 },
            ],
          },
        },
      ],
    },
    scoreIndexes: [{ id: 'i1', key: 'satisfaction', method: 'avg' }],
  };

  const seed = async (settings: Record<string, unknown> = {}) => {
    const org = await ds
      .getRepository(OrganizationEntity)
      .save({ name: 'سازمان تست' });
    organizationId = org.id;

    await ds.getRepository(PlanPolicyEntity).save({
      planCode: PlanCode.FREE,
      limits: { activeForms: 1, responsesPerMonth: 2 },
    });
    await ds.getRepository(SubscriptionEntity).save({
      organizationId: org.id,
      planCode: PlanCode.FREE,
      isActive: true,
    });

    const workspace = await ds
      .getRepository(WorkspaceEntity)
      .save({ organizationId: org.id, name: 'فضا' });

    const form = await ds.getRepository(FormEntity).save({
      workspaceId: workspace.id,
      title: 'فرم تست',
      slug: `form-${Date.now()}`,
      status: FormStatus.ACTIVE,
      settings,
    });

    await ds.getRepository(FormVersionEntity).save({
      formId: form.id,
      version: 1,
      structure,
    });

    const publication = await ds.getRepository(PublicationEntity).save({
      formId: form.id,
      type: PublicationType.LINK,
      token: `tok-${Date.now()}`,
      isActive: true,
    });

    publicationToken = publication.token;
    return { form, publication, workspace };
  };

  beforeEach(async () => {
    ds = await createTestDataSource();

    const planService = new PlanService(
      ds.getRepository(PlanPolicyEntity),
      ds.getRepository(SubscriptionEntity),
      ds.getRepository(UsageCounterEntity),
      ds.getRepository(WorkspaceEntity),
      ds.getRepository(FormEntity),
    );

    const jwt = new JwtService({ secret: 'test-secret' });
    const messaging = {
      send: jest.fn().mockResolvedValue({ status: 'sent' }),
    } as unknown as MessagingService;

    respondentAuth = new RespondentAuthService(
      ds.getRepository(OtpChallengeEntity),
      messaging,
      jwt,
    );

    service = new PublicService(
      ds.getRepository(PublicationEntity),
      ds.getRepository(FormVersionEntity),
      ds.getRepository(ResponseEntity),
      ds.getRepository(AnswerFlatEntity),
      planService,
      new ScoreEngineService(),
      new LogicEngineService(),
      new LogicRuntimeService(),
      respondentAuth,
      new PlatformSettingsService(
        ds.getRepository(PlatformSettingsEntity),
        ds.getRepository(UserEntity),
      ),
    );
  });

  afterEach(async () => {
    await ds.destroy();
  });

  describe('getByToken', () => {
    it('فرم را با توکن معتبر برمی‌گرداند', async () => {
      await seed();
      const payload = await service.getByToken(publicationToken);
      expect(payload.formTitle).toBe('فرم تست');
      expect(payload.organizationId).toBe(organizationId);
    });

    it('توکن ناموجود را رد می‌کند', async () => {
      await seed();
      await expect(service.getByToken('نامعتبر')).rejects.toThrow(
        'لینک معتبر نیست',
      );
    });

    it('انتشار غیرفعال را رد می‌کند', async () => {
      const { publication } = await seed();
      await ds
        .getRepository(PublicationEntity)
        .update(publication.id, { isActive: false });
      await expect(service.getByToken(publicationToken)).rejects.toThrow(
        'لینک معتبر نیست',
      );
    });

    it('لینک منقضی‌شده را رد می‌کند', async () => {
      const { publication } = await seed();
      await ds
        .getRepository(PublicationEntity)
        .update(publication.id, { expiresAt: new Date(Date.now() - 1000) });
      await expect(service.getByToken(publicationToken)).rejects.toThrow(
        'مهلت پاسخگویی این لینک تمام شده است',
      );
    });
  });

  describe('submitByToken', () => {
    it('پاسخ را با شاخص محاسبه‌شده ثبت می‌کند', async () => {
      await seed();
      const result = await service.submitByToken(publicationToken, {
        answers: { q1: 'بله', rate: 4 },
      });

      expect(result.status).toBe('completed');
      expect(result.scores).toEqual({ satisfaction: 4 });

      const stored = await ds.getRepository(ResponseEntity).find();
      expect(stored).toHaveLength(1);
      expect(stored[0].status).toBe(ResponseStatus.COMPLETED);
    });

    it('پاسخ سوال پنهان را ذخیره نمی‌کند', async () => {
      await seed();
      await service.submitByToken(publicationToken, {
        answers: { q1: 'بله', rate: 9, why: 'نباید ذخیره شود' },
      });

      const [stored] = await ds.getRepository(ResponseEntity).find();
      expect(stored.answers).toEqual({ q1: 'بله', rate: 9 });
    });

    it('جدول تخت پاسخ‌ها را برای گزارش‌گیری پر می‌کند', async () => {
      await seed();
      await service.submitByToken(publicationToken, {
        answers: { q1: 'بله', rate: 4 },
      });

      const flat = await ds.getRepository(AnswerFlatEntity).find();
      expect(flat.map((row) => row.questionId).sort()).toEqual(['q1', 'rate']);
      expect(flat.find((r) => r.questionId === 'rate')?.valueNumber).toBe(4);
    });

    it('پاسخ تکراری را وقتی تنظیم فعال است رد می‌کند', async () => {
      await seed({ preventDuplicate: true });
      await service.submitByToken(publicationToken, {
        respondentKey: 'user-1',
        answers: { q1: 'بله', rate: 4 },
      });

      await expect(
        service.submitByToken(publicationToken, {
          respondentKey: 'user-1',
          answers: { q1: 'خیر', rate: 2 },
        }),
      ).rejects.toThrow('پاسخ تکراری مجاز نیست');
    });

    it('وقتی تنظیم غیرفعال است پاسخ تکراری را می‌پذیرد', async () => {
      await seed({ preventDuplicate: false });
      await service.submitByToken(publicationToken, {
        respondentKey: 'user-1',
        answers: { q1: 'بله', rate: 4 },
      });
      await service.submitByToken(publicationToken, {
        respondentKey: 'user-1',
        answers: { q1: 'خیر', rate: 2 },
      });

      expect(await ds.getRepository(ResponseEntity).count()).toBe(2);
    });

    it('گیرندگان متفاوت با کنترل تکرار مستقل‌اند', async () => {
      await seed({ preventDuplicate: true });
      await service.submitByToken(publicationToken, {
        respondentKey: 'user-1',
        answers: { q1: 'بله', rate: 4 },
      });
      await service.submitByToken(publicationToken, {
        respondentKey: 'user-2',
        answers: { q1: 'بله', rate: 5 },
      });

      expect(await ds.getRepository(ResponseEntity).count()).toBe(2);
    });

    it('پس از پر شدن سقف ماهانه پلن، پاسخ جدید را رد می‌کند', async () => {
      // سقف پلن رایگان در این تست ۲ است.
      await seed();
      await service.submitByToken(publicationToken, {
        answers: { q1: 'بله', rate: 4 },
      });
      await service.submitByToken(publicationToken, {
        answers: { q1: 'بله', rate: 5 },
      });

      await expect(
        service.submitByToken(publicationToken, {
          answers: { q1: 'بله', rate: 6 },
        }),
      ).rejects.toThrow('سقف پاسخ‌نامه ماهانه پلن شما (2) تکمیل شده است');

      expect(await ds.getRepository(ResponseEntity).count()).toBe(2);
    });

    it('مصرف پاسخ‌نامه را برای سقف پلن می‌شمارد', async () => {
      await seed();
      await service.submitByToken(publicationToken, {
        answers: { q1: 'بله', rate: 4 },
      });

      const [counter] = await ds.getRepository(UsageCounterEntity).find();
      expect(counter.metric).toBe('response_submitted');
      expect(counter.used).toBe(1);
    });
  });

  describe('ذخیره‌ی پیشرفت', () => {
    it('پیشرفت را ذخیره و بازیابی می‌کند', async () => {
      await seed();
      await service.saveProgressByToken(publicationToken, {
        respondentKey: 'user-1',
        answers: { q1: 'بله' },
      });

      const progress = await service.getProgressByToken(
        publicationToken,
        'user-1',
      );
      expect(progress.exists).toBe(true);
      expect(progress.answers).toEqual({ q1: 'بله' });
    });

    it('بدون کلید پاسخ‌دهنده پیشرفت ذخیره نمی‌شود', async () => {
      await seed();
      await expect(
        service.saveProgressByToken(publicationToken, { answers: { q1: 'x' } }),
      ).rejects.toThrow('برای ذخیره پیشرفت، respondentKey لازم است');
    });

    it('ثبت نهایی همان پیش‌نویس را تکمیل می‌کند نه رکورد جدید', async () => {
      await seed();
      await service.saveProgressByToken(publicationToken, {
        respondentKey: 'user-1',
        answers: { q1: 'بله' },
      });
      await service.submitByToken(publicationToken, {
        respondentKey: 'user-1',
        answers: { q1: 'بله', rate: 4 },
      });

      const stored = await ds.getRepository(ResponseEntity).find();
      expect(stored).toHaveLength(1);
      expect(stored[0].status).toBe(ResponseStatus.COMPLETED);
      expect(stored[0].submittedAt).toBeTruthy();
    });

    it('پیشرفت پاسخ‌دهنده‌ی دیگر را برنمی‌گرداند', async () => {
      await seed();
      await service.saveProgressByToken(publicationToken, {
        respondentKey: 'user-1',
        answers: { q1: 'بله' },
      });

      const other = await service.getProgressByToken(
        publicationToken,
        'user-2',
      );
      expect(other.exists).toBe(false);
      expect(other.answers).toEqual({});
    });
  });

  describe('nextStepByToken', () => {
    it('صفحه‌ی اول را با سوالاتش می‌دهد', async () => {
      await seed();
      const step = await service.nextStepByToken(publicationToken, {});
      expect(step.page?.id).toBe('p1');
      expect(step.page?.questions.map((q) => q.id)).toEqual(['q1', 'rate']);
    });

    it('سوال شرطی را بر اساس شاخص نمایش می‌دهد یا پنهان می‌کند', async () => {
      await seed();
      const hidden = await service.nextStepByToken(publicationToken, {
        currentPageId: 'p1',
        answers: { rate: 9 },
      });
      expect(hidden.page?.questions).toHaveLength(0);

      const shown = await service.nextStepByToken(publicationToken, {
        currentPageId: 'p1',
        answers: { rate: 2 },
      });
      expect(shown.page?.questions.map((q) => q.id)).toEqual(['why']);
    });
  });
});
