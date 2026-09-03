jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
  InjectDataSource: () => () => undefined,
  getRepositoryToken: (entity: unknown) => entity,
  TypeOrmModule: { forFeature: () => ({}), forRoot: () => ({}) },
}));

import type { DataSource } from 'typeorm';
import { FormEntity, FormStatus } from '../database/entities/form.entity';
import { OrganizationEntity } from '../database/entities/organization.entity';
import {
  PlanCode,
  PlanPolicyEntity,
} from '../database/entities/plan-policy.entity';
import { SubscriptionEntity } from '../database/entities/subscription.entity';
import { UsageCounterEntity } from '../database/entities/usage-counter.entity';
import { WorkspaceEntity } from '../database/entities/workspace.entity';
import { createTestDataSource } from '../testing/test-database';
import { PlanService } from './plan.service';

describe('PlanService — سقف پلن و شمارش مصرف', () => {
  let ds: DataSource;
  let service: PlanService;
  let organizationId: string;
  let workspaceId: string;

  const seedPlan = async (
    planCode: PlanCode,
    limits: Record<string, unknown>,
  ) => {
    await ds.getRepository(PlanPolicyEntity).save({ planCode, limits });
    await ds.getRepository(SubscriptionEntity).save({
      organizationId,
      planCode,
      isActive: true,
    });
  };

  beforeEach(async () => {
    ds = await createTestDataSource();

    const org = await ds
      .getRepository(OrganizationEntity)
      .save({ name: 'سازمان' });
    organizationId = org.id;

    const workspace = await ds
      .getRepository(WorkspaceEntity)
      .save({ organizationId, name: 'فضا' });
    workspaceId = workspace.id;

    service = new PlanService(
      ds.getRepository(PlanPolicyEntity),
      ds.getRepository(SubscriptionEntity),
      ds.getRepository(UsageCounterEntity),
      ds.getRepository(WorkspaceEntity),
      ds.getRepository(FormEntity),
    );
  });

  afterEach(async () => {
    await ds.destroy();
  });

  const addForm = (status: FormStatus) =>
    ds.getRepository(FormEntity).save({
      workspaceId,
      title: 'فرم',
      slug: `f-${Math.random().toString(36).slice(2)}`,
      status,
      settings: {},
    });

  describe('resolvePlan', () => {
    it('سازمان بدون اشتراک را رایگان در نظر می‌گیرد', async () => {
      await expect(service.resolvePlan(organizationId)).resolves.toBe(
        PlanCode.FREE,
      );
    });

    it('پلن اشتراک فعال را برمی‌گرداند', async () => {
      await seedPlan(PlanCode.ORG, { activeForms: 10 });
      await expect(service.resolvePlan(organizationId)).resolves.toBe(
        PlanCode.ORG,
      );
    });

    it('اشتراک غیرفعال را نادیده می‌گیرد', async () => {
      await ds.getRepository(SubscriptionEntity).save({
        organizationId,
        planCode: PlanCode.ENTERPRISE,
        isActive: false,
      });
      await expect(service.resolvePlan(organizationId)).resolves.toBe(
        PlanCode.FREE,
      );
    });
  });

  describe('canCreateForm', () => {
    it('وقتی زیر سقف است اجازه می‌دهد', async () => {
      await seedPlan(PlanCode.FREE, { activeForms: 2 });
      await addForm(FormStatus.ACTIVE);

      const result = await service.canCreateForm(workspaceId);
      expect(result.allowed).toBe(true);
    });

    it('در سقف پلن اجازه نمی‌دهد', async () => {
      await seedPlan(PlanCode.FREE, { activeForms: 1 });
      await addForm(FormStatus.ACTIVE);

      const result = await service.canCreateForm(workspaceId);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('سقف فرم فعال');
    });

    it('فرم پیش‌نویس در سقف فرم فعال شمرده نمی‌شود', async () => {
      await seedPlan(PlanCode.FREE, { activeForms: 1 });
      await addForm(FormStatus.DRAFT);

      await expect(service.canCreateForm(workspaceId)).resolves.toMatchObject({
        allowed: true,
      });
    });

    it('سقف منفی یعنی نامحدود', async () => {
      await seedPlan(PlanCode.ENTERPRISE, { activeForms: -1 });
      await addForm(FormStatus.ACTIVE);
      await addForm(FormStatus.ACTIVE);

      await expect(service.canCreateForm(workspaceId)).resolves.toMatchObject({
        allowed: true,
      });
    });

    it('فضای کاری نامعتبر را رد می‌کند', async () => {
      const result = await service.canCreateForm(
        '00000000-0000-0000-0000-000000000000',
      );
      expect(result.allowed).toBe(false);
    });
  });

  describe('trackUsage', () => {
    it('شمارنده‌ی ماه جاری را می‌سازد و جمع می‌زند', async () => {
      await seedPlan(PlanCode.FREE, { responsesPerMonth: 200 });

      await service.trackUsage(organizationId, 'response_submitted', 1);
      await service.trackUsage(organizationId, 'response_submitted', 2);

      const counters = await ds.getRepository(UsageCounterEntity).find();
      expect(counters).toHaveLength(1);
      expect(counters[0].used).toBe(3);
      expect(counters[0].limitValue).toBe(200);
      expect(counters[0].periodKey).toBe(new Date().toISOString().slice(0, 7));
    });

    it('معیارهای متفاوت شمارنده‌ی جدا دارند', async () => {
      await seedPlan(PlanCode.FREE, { responsesPerMonth: 200 });

      await service.trackUsage(organizationId, 'response_submitted', 1);
      await service.trackUsage(organizationId, 'sms_sent', 1);

      expect(await ds.getRepository(UsageCounterEntity).count()).toBe(2);
    });
  });

  describe('canAcceptResponse', () => {
    it('زیر سقف اجازه می‌دهد', async () => {
      await seedPlan(PlanCode.FREE, { responsesPerMonth: 3 });
      await service.trackUsage(organizationId, 'response_submitted', 2);

      await expect(
        service.canAcceptResponse(organizationId),
      ).resolves.toMatchObject({ allowed: true, used: 2, limit: 3 });
    });

    it('در سقف اجازه نمی‌دهد', async () => {
      await seedPlan(PlanCode.FREE, { responsesPerMonth: 3 });
      await service.trackUsage(organizationId, 'response_submitted', 3);

      const result = await service.canAcceptResponse(organizationId);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('(3)');
    });

    it('سقف منفی یعنی نامحدود', async () => {
      await seedPlan(PlanCode.ENTERPRISE, { responsesPerMonth: -1 });
      await service.trackUsage(organizationId, 'response_submitted', 5000);

      await expect(
        service.canAcceptResponse(organizationId),
      ).resolves.toMatchObject({ allowed: true });
    });

    it('نبودن سقف در پلن یعنی نامحدود', async () => {
      await seedPlan(PlanCode.PRO, { activeForms: 5 });
      await expect(
        service.canAcceptResponse(organizationId),
      ).resolves.toMatchObject({ allowed: true });
    });

    it('مصرف معیار دیگر روی سقف پاسخ اثر ندارد', async () => {
      await seedPlan(PlanCode.FREE, { responsesPerMonth: 1 });
      await service.trackUsage(organizationId, 'sms_sent', 100);

      await expect(
        service.canAcceptResponse(organizationId),
      ).resolves.toMatchObject({ allowed: true });
    });
  });

  describe('getWorkspacePolicy', () => {
    it('سیاست پلن سازمانِ فضای کاری را می‌دهد', async () => {
      await seedPlan(PlanCode.ORG, { maxQuestionTypes: 16 });
      await expect(service.getWorkspacePolicy(workspaceId)).resolves.toEqual({
        maxQuestionTypes: 16,
      });
    });

    it('برای فضای کاری ناموجود null می‌دهد', async () => {
      await expect(
        service.getWorkspacePolicy('00000000-0000-0000-0000-000000000000'),
      ).resolves.toBeNull();
    });
  });
});
