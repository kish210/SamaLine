jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import type { DataSource } from 'typeorm';
import { FormEntity } from '../database/entities/form.entity';
import { OrganizationEntity } from '../database/entities/organization.entity';
import {
  PlanCode,
  PlanPolicyEntity,
} from '../database/entities/plan-policy.entity';
import { DeliveryLogEntity } from '../database/entities/delivery-log.entity';
import {
  PublicationEntity,
  PublicationType,
} from '../database/entities/publication.entity';
import { DistributionService } from '../distribution/distribution.service';
import { SubscriptionEntity } from '../database/entities/subscription.entity';
import { UsageCounterEntity } from '../database/entities/usage-counter.entity';
import { WorkspaceEntity } from '../database/entities/workspace.entity';
import { createTestDataSource } from '../testing/test-database';
import { PlanService } from './plan.service';

describe('اعمال سقف‌ها و امکانات پلن', () => {
  let ds: DataSource;
  let plans: PlanService;
  let organizationId: string;
  let workspaceId: string;

  const usePlan = async (limits: Record<string, unknown>) => {
    await ds
      .getRepository(PlanPolicyEntity)
      .save({ planCode: PlanCode.FREE, limits });
    await ds
      .getRepository(SubscriptionEntity)
      .save({ organizationId, planCode: PlanCode.FREE, isActive: true });
  };

  beforeEach(async () => {
    ds = await createTestDataSource();
    organizationId = (
      await ds.getRepository(OrganizationEntity).save({ name: 'سازمان' })
    ).id;
    workspaceId = (
      await ds
        .getRepository(WorkspaceEntity)
        .save({ organizationId, name: 'فضا' })
    ).id;
    plans = new PlanService(
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

  describe('assertFeature', () => {
    it('امکان خاموش رد می‌شود و نام فارسی‌اش در پیام می‌آید', async () => {
      await usePlan({ embed: false, logicSkip: true });
      await expect(
        plans.assertFeature(organizationId, 'embed'),
      ).rejects.toThrow('جاسازی در سایت');
      await expect(
        plans.assertFeature(organizationId, 'logicSkip'),
      ).resolves.toBeUndefined();
    });

    it('کلید نبوده در پلن هم رد می‌شود، نه اینکه باز بماند', async () => {
      await usePlan({});
      await expect(
        plans.assertFeature(organizationId, 'multiLanguage'),
      ).rejects.toThrow('پلن فعلی');
    });
  });

  describe('assertQuota', () => {
    it('صفر یعنی نبودن امکان، نه سقف صفر', async () => {
      await usePlan({ kiosk: 0 });
      await expect(
        plans.assertQuota(organizationId, 'kiosk', 0),
      ).rejects.toThrow('در پلن فعلی سازمان شما نیست');
    });

    it('تا پیش از پر شدن سقف اجازه می‌دهد', async () => {
      await usePlan({ dashboards: 2 });
      await expect(
        plans.assertQuota(organizationId, 'dashboards', 1),
      ).resolves.toBeUndefined();
      await expect(
        plans.assertQuota(organizationId, 'dashboards', 2),
      ).rejects.toThrow('پر شده');
    });

    it('۱- یعنی نامحدود', async () => {
      await usePlan({ portal: -1 });
      await expect(
        plans.assertQuota(organizationId, 'portal', 9999),
      ).resolves.toBeUndefined();
    });
  });

  it('سازمانِ یک فضای کاری پیدا می‌شود؛ فضای ناموجود null', async () => {
    await expect(plans.organizationOfWorkspace(workspaceId)).resolves.toBe(
      organizationId,
    );
    await expect(
      plans.organizationOfWorkspace('00000000-0000-4000-8000-000000000000'),
    ).resolves.toBeNull();
  });

  /**
   * نوع انتشار محدودشده نباید با ساختن فرم تازه دور زده شود: سقف روی کل
   * سازمان شمرده می‌شود، نه هر فرم.
   */
  describe('انتشار کیوسک و Embed', () => {
    const buildDistribution = () =>
      new DistributionService(
        ds.getRepository(DeliveryLogEntity),
        ds.getRepository(PublicationEntity),
        plans,
      );

    const newForm = async (title: string) =>
      (
        await ds.getRepository(FormEntity).save({
          workspaceId,
          title,
          slug: title,
        })
      ).id;

    it('Embed بدون امکان پلن رد می‌شود', async () => {
      await usePlan({ embed: false, kiosk: 1 });
      const service = buildDistribution();
      await expect(
        service.createChannelPublication(
          await newForm('f1'),
          PublicationType.EMBED,
          organizationId,
        ),
      ).rejects.toThrow('جاسازی در سایت');
    });

    it('سقف کیوسک روی کل سازمان است، نه هر فرم', async () => {
      await usePlan({ kiosk: 1 });
      const service = buildDistribution();
      await service.createChannelPublication(
        await newForm('f1'),
        PublicationType.KIOSK,
        organizationId,
      );
      await expect(
        service.createChannelPublication(
          await newForm('f2'),
          PublicationType.KIOSK,
          organizationId,
        ),
      ).rejects.toThrow('پر شده');
    });

    it('نوع‌های پایه (لینک) به پلن کاری ندارند', async () => {
      await usePlan({ kiosk: 0, embed: false });
      const service = buildDistribution();
      await expect(
        service.createChannelPublication(
          await newForm('f1'),
          PublicationType.LINK,
          organizationId,
        ),
      ).resolves.toMatchObject({ type: PublicationType.LINK });
    });
  });
});
