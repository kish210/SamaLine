jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import { HotelSetupService, STANDARD_UNITS } from './hotel-setup.service';

/** جعل‌های درون‌حافظه‌ای؛ فقط منطقِ راه‌اندازی (ساخت/تکرارپذیری) سنجیده می‌شود. */
function makeFakes(opts: { formCreateFails?: boolean } = {}) {
  const depts: Array<{ id: string; key: string; name: string }> = [];
  const forms: Array<{ id: string; departmentId: string | null; templateKey?: string }> = [];
  const dashboards: Array<{
    id: string;
    departmentId: string | null;
    name: string;
    widgets: unknown[];
  }> = [];
  const portals: Array<{
    id: string;
    departmentId: string | null;
    formIds: string[];
  }> = [];
  let n = 0;

  const departments = {
    list: async () => depts.map((d) => ({ ...d, memberCount: 0 })),
    create: async (_org: string, input: { name: string; key: string }) => {
      const d = { id: `d${++n}`, ...input };
      depts.push(d);
      return d;
    },
  };
  const formService = {
    list: async () => forms,
    create: async (dto: { departmentId: string; templateKey: string }) => {
      if (opts.formCreateFails) throw new Error('سقفِ پلن');
      const f = { id: `f${++n}`, departmentId: dto.departmentId, templateKey: dto.templateKey };
      forms.push(f);
      return f;
    },
  };
  const dashboardService = {
    list: async () => dashboards,
    create: async (_org: string, name: string, departmentId: string) => {
      const d = { id: `b${++n}`, name, departmentId, widgets: [] as unknown[] };
      dashboards.push(d);
      return d;
    },
    update: async (_org: string, id: string, patch: { widgets: unknown[] }) => {
      const d = dashboards.find((x) => x.id === id)!;
      d.widgets = patch.widgets;
      return d;
    },
  };
  const portalService = {
    list: async () => portals,
    save: async (
      _ws: string,
      _id: string | null,
      input: { departmentId?: string | null; formIds?: string[] },
    ) => {
      const p = {
        id: `p${++n}`,
        departmentId: input.departmentId ?? null,
        formIds: input.formIds ?? [],
      };
      portals.push(p);
      return p;
    },
  };
  const service = new HotelSetupService(
    departments as never,
    formService as never,
    dashboardService as never,
    portalService as never,
  );
  return { service, depts, forms, dashboards, portals };
}

describe('HotelSetupService — واحدهای استانداردِ هتل', () => {
  it('هر پنج واحد را با فرمِ عملیاتی و داشبوردِ خودش می‌سازد', async () => {
    const f = makeFakes();
    const result = await f.service.setupStandardUnits('org', 'ws');

    expect(result.map((r) => r.key)).toEqual(STANDARD_UNITS.map((u) => u.key));
    expect(f.depts.map((d) => d.name)).toContain('فنی');
    expect(f.forms).toHaveLength(5);
    expect(f.forms.find((x) => x.templateKey === 'ops-technical-daily')).toBeTruthy();
    expect(f.dashboards).toHaveLength(5);
    // داشبورد به همان بخش وصل است و ویجت‌هایش به همان فرم اشاره می‌کنند.
    const technical = result.find((r) => r.key === 'technical')!;
    const dash = f.dashboards.find((d) => d.departmentId === technical.departmentId)!;
    expect(dash.name).toContain('فنی');
    expect(JSON.stringify(dash.widgets)).toContain(
      f.forms.find((x) => x.departmentId === technical.departmentId)!.id,
    );
    // هر واحد یک پرتال هم می‌گیرد که فرمِ همان واحد را دارد.
    expect(f.portals).toHaveLength(5);
    const techPortal = f.portals.find((p) => p.departmentId === technical.departmentId)!;
    expect(techPortal.formIds).toContain(
      f.forms.find((x) => x.departmentId === technical.departmentId)!.id,
    );
    expect(result.every((r) => r.portal === 'created')).toBe(true);
  });

  it('اجرای دوباره چیزِ تکراری نمی‌سازد', async () => {
    const f = makeFakes();
    await f.service.setupStandardUnits('org', 'ws');
    const again = await f.service.setupStandardUnits('org', 'ws');
    expect(f.depts).toHaveLength(5);
    expect(f.forms).toHaveLength(5);
    expect(f.dashboards).toHaveLength(5);
    expect(f.portals).toHaveLength(5);
    expect(again.every((r) => r.department === 'existing')).toBe(true);
    expect(
      again.every(
        (r) => r.form === 'existing' && r.dashboard === 'existing' && r.portal === 'existing',
      ),
    ).toBe(true);
  });

  it('شکستِ ساختِ فرم (مثلا سقفِ پلن) بخش و داشبورد را نمی‌شکند', async () => {
    const f = makeFakes({ formCreateFails: true });
    const result = await f.service.setupStandardUnits('org', 'ws');
    expect(f.depts).toHaveLength(5);
    expect(f.dashboards).toHaveLength(5);
    expect(result.every((r) => r.form === 'skipped' && r.note)).toBe(true);
  });
});
