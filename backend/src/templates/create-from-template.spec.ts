jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
  InjectDataSource: () => () => undefined,
  getRepositoryToken: (entity: unknown) => entity,
  TypeOrmModule: { forFeature: () => ({}), forRoot: () => ({}) },
}));

import type { DataSource } from 'typeorm';
import { FormEntity } from '../database/entities/form.entity';
import { FormVersionEntity } from '../database/entities/form-version.entity';
import { OrganizationEntity } from '../database/entities/organization.entity';
import {
  PlanCode,
  PlanPolicyEntity,
} from '../database/entities/plan-policy.entity';
import { PublicationEntity } from '../database/entities/publication.entity';
import { ResponseEntity } from '../database/entities/response.entity';
import { SubscriptionEntity } from '../database/entities/subscription.entity';
import { UsageCounterEntity } from '../database/entities/usage-counter.entity';
import { WorkspaceEntity } from '../database/entities/workspace.entity';
import { DEFAULT_PLAN_LIMITS } from '../database/plan-defaults';
import { FormService } from '../forms/form.service';
import { LogicEngineService } from '../forms/logic-engine.service';
import { ScoreEngineService } from '../forms/score-engine.service';
import type { FormStructure } from '../forms/logic-types';
import { PlanService } from '../plans/plan.service';
import { createTestDataSource } from '../testing/test-database';
import { FORM_TEMPLATES } from './form-templates';

/**
 * ساخت واقعی فرم از روی هر قالب.
 *
 * از همان مسیر پنل می‌گذرد (FormService.create با templateKey) تا
 * اعتبارسنجی نوع سوال، سقف انواع پلن و منطق فرم دقیقا مثل استفاده‌ی
 * واقعی اجرا شود. پلن سازمانی است تا شاخص‌ها و منطق قالب دست‌نخورده
 * بمانند؛ رفتار پلن رایگان جداگانه در پایین آزموده می‌شود.
 */
describe('ساخت فرم از قالب', () => {
  let ds: DataSource;
  let service: FormService;
  let workspaceId: string;

  beforeAll(async () => {
    ds = await createTestDataSource();
    const org = await ds
      .getRepository(OrganizationEntity)
      .save({ name: 'سازمان' });
    await ds.getRepository(PlanPolicyEntity).save({
      planCode: PlanCode.ENTERPRISE,
      // فقط سقف تعداد فرم برداشته شده تا همه‌ی قالب‌ها در یک سازمان ساخته شوند.
      limits: { ...DEFAULT_PLAN_LIMITS[PlanCode.ENTERPRISE], activeForms: -1 },
    });
    await ds.getRepository(SubscriptionEntity).save({
      organizationId: org.id,
      planCode: PlanCode.ENTERPRISE,
      isActive: true,
    });
    workspaceId = (
      await ds
        .getRepository(WorkspaceEntity)
        .save({ organizationId: org.id, name: 'فضا' })
    ).id;

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

  afterAll(async () => {
    await ds.destroy();
  });

  const creatable = FORM_TEMPLATES.filter((t) => t.key !== 'all-types');

  it.each(creatable.map((t) => [t.key, t]))(
    'قالب %s ساخته می‌شود و شاخص‌هایش کار می‌کنند',
    async (key, template) => {
      const form = await service.create({
        workspaceId,
        title: template.title,
        slug: `t-${key}`,
        templateKey: key,
      });

      const structure = form.latestVersion?.structure as FormStructure;
      const questionCount = (structure.pages ?? []).reduce(
        (sum, page) => sum + (page.questions?.length ?? 0),
        0,
      );
      const expected = template.structure.pages.reduce(
        (sum, page) => sum + (page.questions?.length ?? 0),
        0,
      );
      expect(questionCount).toBe(expected);

      // با پاسخ کامل به همه‌ی سوال‌های امتیازی، هر شاخص عددی بین ۰ و سقف می‌دهد.
      const answers: Record<string, unknown> = {};
      for (const question of (structure.pages ?? []).flatMap(
        (p) => p.questions ?? [],
      )) {
        if (question.type === 'rating') {
          answers[question.id] = (question.meta as { max: number }).max;
        }
        if (question.type === 'nps') answers[question.id] = 10;
      }
      const scores = new ScoreEngineService().calculate(structure, answers);
      for (const index of structure.scoreIndexes ?? []) {
        expect(scores[index.key]).toBe(index.maxScore);
      }
    },
  );
});

/**
 * پلن رایگان منطق شرطی و شاخص ندارد.
 *
 * اگر ساخت قالب به‌خاطر این رد می‌شد، کتابخانه‌ی ۴۶ قالبی در پلن رایگان
 * بی‌استفاده می‌ماند؛ پس سوال‌ها می‌مانند و فقط چیزی که پلن ندارد کنار
 * گذاشته می‌شود — ولی همان چیز اگر مستقیم در درخواست بیاید رد می‌شود.
 */
describe('قالب روی پلن رایگان', () => {
  let ds: DataSource;
  let service: FormService;
  let workspaceId: string;

  beforeAll(async () => {
    ds = await createTestDataSource();
    const org = await ds
      .getRepository(OrganizationEntity)
      .save({ name: 'سازمان رایگان' });
    await ds.getRepository(PlanPolicyEntity).save({
      planCode: PlanCode.FREE,
      limits: { ...DEFAULT_PLAN_LIMITS[PlanCode.FREE], activeForms: -1 },
    });
    await ds.getRepository(SubscriptionEntity).save({
      organizationId: org.id,
      planCode: PlanCode.FREE,
      isActive: true,
    });
    workspaceId = (
      await ds
        .getRepository(WorkspaceEntity)
        .save({ organizationId: org.id, name: 'فضا' })
    ).id;
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

  afterAll(async () => {
    await ds.destroy();
  });

  /** قالبی که هم منطق شرطی دارد و هم شاخص؛ نبودش یعنی خود قالب‌ها ایراد دارند. */
  const withLogicAndIndex = FORM_TEMPLATES.find(
    (t) =>
      (t.structure.logic?.display as unknown[] | undefined)?.length &&
      t.structure.scoreIndexes?.length,
  );
  if (!withLogicAndIndex) {
    throw new Error('قالبی با منطق شرطی و شاخص پیدا نشد');
  }

  it('همه‌ی سوال‌ها می‌مانند، منطق و شاخص کنار گذاشته و گزارش می‌شوند', async () => {
    const form = (await service.create({
      workspaceId,
      title: withLogicAndIndex.title,
      slug: 'free-template',
      templateKey: withLogicAndIndex.key,
    })) as unknown as {
      latestVersion?: { structure: FormStructure };
      planSkipped?: string[];
    };

    const structure = form.latestVersion?.structure as FormStructure;
    const questionCount = (structure.pages ?? []).reduce(
      (sum, page) => sum + (page.questions?.length ?? 0),
      0,
    );
    expect(questionCount).toBe(
      withLogicAndIndex.structure.pages.reduce(
        (sum, page) => sum + (page.questions?.length ?? 0),
        0,
      ),
    );
    expect(structure.logic?.display ?? []).toHaveLength(0);
    expect(structure.scoreIndexes ?? []).toHaveLength(0);
    expect(form.planSkipped).toEqual(
      expect.arrayContaining(['منطق شرطی نمایش', 'شاخص و وزن‌دهی']),
    );
  });

  it('همان منطق اگر مستقیم در درخواست بیاید رد می‌شود', async () => {
    const pages = withLogicAndIndex.structure.pages as never;
    await expect(
      service.create({
        workspaceId,
        title: 'دستی',
        slug: 'free-manual',
        pages,
        logic: withLogicAndIndex.structure.logic,
      }),
    ).rejects.toThrow('منطق شرطی نمایش');
  });
});
