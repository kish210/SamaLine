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
import { LogicEngineService } from './logic-engine.service';
import { FormService } from './form.service';
import { PlanService } from '../plans/plan.service';
import { createTestDataSource } from '../testing/test-database';

/**
 * چرخه‌ی عمر فرم: بایگانی (برگشت‌پذیر) و حذف همیشگی (برگشت‌ناپذیر).
 *
 * روی پایگاه‌داده‌ی واقعی اجرا می‌شود چون نکته‌ی اصلی همین آبشار حذف است؛
 * با مخزن ساختگی، پاک شدن یا نشدن پاسخ‌ها اصلا دیده نمی‌شود.
 */
describe('FormService — بایگانی و حذف', () => {
  let ds: DataSource;
  let service: FormService;

  const seed = async () => {
    const org = await ds
      .getRepository(OrganizationEntity)
      .save({ name: 'سازمان' });
    await ds.getRepository(PlanPolicyEntity).save({
      planCode: PlanCode.FREE,
      limits: { activeForms: 10, responsesPerMonth: 100 },
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
      title: 'فرم',
      slug: `f-${Date.now()}`,
      status: FormStatus.ACTIVE,
      settings: {},
    });
    const version = await ds
      .getRepository(FormVersionEntity)
      .save({ formId: form.id, version: 1, structure: { pages: [] } });
    const publication = await ds.getRepository(PublicationEntity).save({
      formId: form.id,
      type: PublicationType.LINK,
      token: `t-${Date.now()}`,
      isActive: true,
    });

    return { form, version, publication, workspace };
  };

  const addResponse = (versionId: string, publicationId: string) =>
    ds.getRepository(ResponseEntity).save({
      formVersionId: versionId,
      publicationId,
      status: ResponseStatus.COMPLETED,
      answers: {},
      scores: {},
      meta: {},
    });

  beforeEach(async () => {
    ds = await createTestDataSource();
    service = new FormService(
      ds.getRepository(FormEntity),
      ds.getRepository(FormVersionEntity),
      ds.getRepository(PublicationEntity),
      ds.getRepository(ResponseEntity),
      new PlanService(
        ds.getRepository(PlanPolicyEntity),
        ds.getRepository(SubscriptionEntity),
        ds.getRepository(UsageCounterEntity),
        ds.getRepository(WorkspaceEntity),
        ds.getRepository(FormEntity),
      ),
      new LogicEngineService(),
    );
  });

  afterEach(async () => {
    await ds.destroy();
  });

  describe('بایگانی', () => {
    it('فرم را از فهرست برمی‌دارد ولی داده را نگه می‌دارد', async () => {
      const { form, version, publication, workspace } = await seed();
      await addResponse(version.id, publication.id);

      await service.setArchived(form.id, true);

      expect(await service.list(workspace.id)).toHaveLength(0);
      expect(await service.list(workspace.id, true)).toHaveLength(1);
      // پاسخ‌ها دست‌نخورده‌اند؛ بایگانی حذف نیست.
      expect(await service.responseCount(form.id)).toBe(1);
    });

    it('لینک فرم بایگانی‌شده بسته می‌شود', async () => {
      const { form, publication } = await seed();
      await service.setArchived(form.id, true);

      const after = await ds
        .getRepository(PublicationEntity)
        .findOne({ where: { id: publication.id } });
      // وگرنه فرمِ کنارگذاشته‌شده همچنان پاسخ می‌گیرد.
      expect(after?.isActive).toBe(false);
    });

    it('بازگرداندن، فرم و لینکش را برمی‌گرداند', async () => {
      const { form, publication, workspace } = await seed();
      await service.setArchived(form.id, true);
      await service.setArchived(form.id, false);

      expect(await service.list(workspace.id)).toHaveLength(1);
      const after = await ds
        .getRepository(PublicationEntity)
        .findOne({ where: { id: publication.id } });
      expect(after?.isActive).toBe(true);
    });
  });

  describe('حذف همیشگی', () => {
    it('بدون تایید تعداد درست، حذف نمی‌شود', async () => {
      const { form, version, publication } = await seed();
      await addResponse(version.id, publication.id);
      await addResponse(version.id, publication.id);

      await expect(service.remove(form.id, 0)).rejects.toThrow('2 پاسخ دارد');
      // فرم باید کاملا دست‌نخورده مانده باشد.
      expect(await service.responseCount(form.id)).toBe(2);
    });

    it('عدد کهنه هم رد می‌شود', async () => {
      /*
       * رابط ممکن است عدد را چند دقیقه پیش خوانده باشد و در این فاصله
       * پاسخ تازه‌ای آمده باشد؛ حذف با عدد کهنه یعنی نابود کردن داده‌ای
       * که کاربر اصلا از وجودش خبر نداشت.
       */
      const { form, version, publication } = await seed();
      await addResponse(version.id, publication.id);
      await addResponse(version.id, publication.id);

      await expect(service.remove(form.id, 1)).rejects.toThrow('2 پاسخ دارد');
    });

    it('با تایید درست، فرم و پاسخ‌هایش پاک می‌شوند', async () => {
      const { form, version, publication, workspace } = await seed();
      await addResponse(version.id, publication.id);

      const result = await service.remove(form.id, 1);
      expect(result).toEqual({ ok: true, deletedResponses: 1 });

      expect(await service.list(workspace.id, true)).toHaveLength(0);
      // آبشار حذف: نسخه، انتشار و پاسخ هم باید رفته باشند.
      expect(await ds.getRepository(ResponseEntity).count()).toBe(0);
      expect(await ds.getRepository(FormVersionEntity).count()).toBe(0);
      expect(await ds.getRepository(PublicationEntity).count()).toBe(0);
    });

    it('فرم بدون پاسخ با تایید صفر پاک می‌شود', async () => {
      const { form } = await seed();
      await expect(service.remove(form.id, 0)).resolves.toMatchObject({
        ok: true,
      });
    });

    it('فرم ناموجود «یافت نشد» می‌دهد', async () => {
      await expect(service.remove('نیست', 0)).rejects.toThrow('فرم یافت نشد');
    });
  });
});
