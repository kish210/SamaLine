jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import type { DataSource } from 'typeorm';
import { DepartmentEntity } from '../database/entities/department.entity';
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
import { OverviewService } from './overview.service';

// «اکنون»ِ ثابت: نیمه‌شبِ UTCِ ۳۱ مارس ۲۰۲۶.
const NOW = new Date('2026-03-31T00:00:00Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);

describe('OverviewService — نمای کلیِ مدیریتی', () => {
  let ds: DataSource;
  let service: OverviewService;
  let orgId: string;
  let wsId: string;
  let technicalId: string;
  let housekeepingId: string;
  let n = 0;

  const makeForm = async (opts: {
    title: string;
    departmentId?: string | null;
    requiresApproval?: boolean;
    status?: FormStatus;
  }) => {
    n += 1;
    const form = await ds.getRepository(FormEntity).save({
      workspaceId: wsId,
      title: opts.title,
      slug: `ov-${n}-${Date.now()}`,
      status: opts.status ?? FormStatus.ACTIVE,
      departmentId: opts.departmentId ?? null,
      settings: opts.requiresApproval ? { requiresApproval: true } : {},
    });
    const version = await ds
      .getRepository(FormVersionEntity)
      .save({ formId: form.id, version: 1, structure: { pages: [] } });
    const pub = await ds.getRepository(PublicationEntity).save({
      formId: form.id,
      type: PublicationType.LINK,
      token: `ovt-${n}-${Date.now()}`,
      isActive: true,
    });
    return { form, version, pub };
  };

  const respond = (
    f: Awaited<ReturnType<typeof makeForm>>,
    submittedAt: Date,
    review?: string,
  ) =>
    ds.getRepository(ResponseEntity).save({
      formVersionId: f.version.id,
      publicationId: f.pub.id,
      status: ResponseStatus.COMPLETED,
      startedAt: submittedAt,
      submittedAt,
      answers: {},
      scores: {},
      meta: review ? { review: { status: review } } : {},
    });

  beforeEach(async () => {
    ds = await createTestDataSource();
    service = new OverviewService(
      ds.getRepository(ResponseEntity),
      ds.getRepository(FormEntity),
      ds.getRepository(DepartmentEntity),
    );
    orgId = (await ds.getRepository(OrganizationEntity).save({ name: 'هتل' })).id;
    wsId = (
      await ds
        .getRepository(WorkspaceEntity)
        .save({ organizationId: orgId, name: 'اصلی' })
    ).id;
    technicalId = (
      await ds
        .getRepository(DepartmentEntity)
        .save({ organizationId: orgId, name: 'فنی', key: 'technical' })
    ).id;
    housekeepingId = (
      await ds
        .getRepository(DepartmentEntity)
        .save({ organizationId: orgId, name: 'خانه‌داری', key: 'housekeeping' })
    ).id;
  });

  afterEach(async () => {
    await ds.destroy();
  });

  const managerScope = { isManager: true, departmentIds: [] as string[] };

  it('بازه‌ی جاری را با بازه‌ی قبل مقایسه و به‌تفکیکِ واحد و فرم تجمیع می‌کند', async () => {
    const tech = await makeForm({ title: 'گزارش فنی', departmentId: technicalId, requiresApproval: true });
    const pub = await makeForm({ title: 'نظرسنجی مهمان' });
    await makeForm({ title: 'چک‌لیست خانه‌داری', departmentId: housekeepingId });

    // بازه‌ی جاری (۷ روز): ۳ فنی + ۱ عمومی.
    await respond(tech, daysAgo(1), 'approved');
    await respond(tech, daysAgo(2), 'rejected');
    await respond(tech, daysAgo(3), 'pending');
    await respond(pub, daysAgo(1));
    // بازه‌ی قبل: ۲.
    await respond(pub, daysAgo(9));
    await respond(pub, daysAgo(10));
    // خیلی قدیمی و هنوز معلق: در آمارِ بازه نیست ولی معلقِ کنونی است.
    await respond(tech, daysAgo(60), 'pending');

    const ov = await service.overview(orgId, wsId, managerScope, 7, NOW);

    expect(ov.totals).toEqual({ current: 4, previous: 2, changePct: 100 });
    expect(ov.review).toEqual({ pending: 2, approved: 1, rejected: 1 });
    expect(ov.series).toHaveLength(7);
    expect(ov.series.reduce((s, p) => s + p.count, 0)).toBe(4);
    // خانه‌داری با صفر هم در تفکیک می‌آید (کم‌کاری هم خبر است).
    expect(ov.byUnit).toEqual([
      { departmentId: technicalId, name: 'فنی', count: 3 },
      { departmentId: null, name: 'عمومی', count: 1 },
      { departmentId: housekeepingId, name: 'خانه‌داری', count: 0 },
    ]);
    expect(ov.topForms.map((f) => [f.title, f.count])).toEqual([
      ['گزارش فنی', 3],
      ['نظرسنجی مهمان', 1],
    ]);
    expect(ov.activeForms).toBe(3);
  });

  it('روز را به وقتِ تهران می‌شمارد، نه UTC', async () => {
    const f = await makeForm({ title: 'شبانه' });
    // ۲۱:۰۰ UTCِ ۲۹ مارس = ۰۰:۳۰ بامدادِ ۳۰ مارس در تهران.
    await respond(f, new Date('2026-03-29T21:00:00Z'));
    const ov = await service.overview(orgId, wsId, managerScope, 7, NOW);
    const hit = ov.series.find((p) => p.count > 0);
    expect(hit?.date).toBe('2026-03-30');
  });

  it('کارمندِ غیرمدیر فقط فرم‌های عمومی و بخشِ خودش را می‌بیند', async () => {
    const tech = await makeForm({ title: 'فنی', departmentId: technicalId });
    const hk = await makeForm({ title: 'خانه‌داری', departmentId: housekeepingId });
    await respond(tech, daysAgo(1));
    await respond(hk, daysAgo(1));
    await respond(hk, daysAgo(2));

    const ov = await service.overview(
      orgId,
      wsId,
      { isManager: false, departmentIds: [technicalId] },
      7,
      NOW,
    );
    expect(ov.totals.current).toBe(1);
    expect(ov.byUnit.map((u) => u.name)).toEqual(['فنی']);
  });

  it('فضای بی‌فرم: صفرها با محورِ کاملِ روزها، و درصدِ تغییر null', async () => {
    const ov = await service.overview(orgId, wsId, managerScope, 30, NOW);
    expect(ov.totals).toEqual({ current: 0, previous: 0, changePct: null });
    expect(ov.series).toHaveLength(30);
    expect(ov.byUnit).toEqual([]);
  });

  it('بازه به ۷ تا ۹۰ روز محدود می‌شود', async () => {
    expect((await service.overview(orgId, wsId, managerScope, 1, NOW)).days).toBe(7);
    expect((await service.overview(orgId, wsId, managerScope, 500, NOW)).days).toBe(90);
  });
});
