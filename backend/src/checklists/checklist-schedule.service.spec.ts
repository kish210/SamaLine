jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import { ChecklistScheduleService } from './checklist-schedule.service';
import { FormStatus } from '../database/entities/form.entity';

type FormRow = {
  id: string;
  title: string;
  departmentId: string | null;
  status: FormStatus;
  settings: Record<string, unknown>;
};

function harness(options: {
  form: Partial<FormRow>;
  completedSince?: boolean;
  memberEmails?: string[];
}) {
  const sent: Array<{ recipient: string; subject?: string }> = [];
  const saved: FormRow[] = [];

  const form: FormRow = {
    id: 'f1',
    title: 'چک‌لیست تأسیسات',
    departmentId: 'dept-fani',
    status: FormStatus.ACTIVE,
    settings: {},
    ...options.form,
  };

  const formRepo = {
    find: async () => [form],
    save: async (row: FormRow) => {
      saved.push(JSON.parse(JSON.stringify(row)));
      Object.assign(form, row);
      return row;
    },
  };
  const publicationRepo = { find: async () => [{ id: 'pub-1' }] };
  const responseRepo = {
    count: async () => (options.completedSince ? 1 : 0),
  };
  const deptMembers = {
    find: async () =>
      (options.memberEmails ?? ['ali@hotel.local']).map((_, i) => ({
        userId: 'u' + i,
      })),
  };
  const users = {
    find: async () =>
      (options.memberEmails ?? ['ali@hotel.local']).map((email, i) => ({
        id: 'u' + i,
        email,
      })),
  };
  const messaging = {
    send: async (m: { recipient: string; subject?: string }) => {
      sent.push(m);
      return { status: 'sent' as const, providerMessage: null };
    },
  };

  const service = new ChecklistScheduleService(
    formRepo as never,
    publicationRepo as never,
    responseRepo as never,
    deptMembers as never,
    users as never,
    messaging as never,
  );
  return { service, sent, saved, form };
}

const daily = (dueHour: number, extra: Record<string, unknown> = {}) => ({
  checklist: { enabled: true, cadence: 'daily', dueHour, ...extra },
});

// یک روز ثابت برای تکرارپذیری: ساعت ۱۲ ظهر UTC.
const NOON = new Date('2026-10-26T12:00:00Z');
const MORNING = new Date('2026-10-26T06:00:00Z');

describe('ChecklistScheduleService', () => {
  it('قبل از موعد هشدار نمی‌دهد', async () => {
    const h = harness({ form: { settings: daily(20) } }); // موعد ۲۰، الان ۱۲
    expect(await h.service.run(NOON)).toBe(0);
    expect(h.sent).toHaveLength(0);
  });

  it('بعد از موعد و بدون ثبت، به اعضای بخش هشدار می‌دهد', async () => {
    const h = harness({
      form: { settings: daily(9) }, // موعد ۹، الان ۱۲
      memberEmails: ['ali@hotel.local', 'reza@hotel.local'],
    });
    expect(await h.service.run(NOON)).toBe(1);
    expect(h.sent.map((m) => m.recipient).sort()).toEqual([
      'ali@hotel.local',
      'reza@hotel.local',
    ]);
    expect(h.sent[0].subject).toContain('چک‌لیست');
  });

  it('اگر در این دوره پاسخِ کامل ثبت شده، هشدار نمی‌دهد', async () => {
    const h = harness({ form: { settings: daily(9) }, completedSince: true });
    expect(await h.service.run(NOON)).toBe(0);
    expect(h.sent).toHaveLength(0);
  });

  it('برای یک دوره دوبار هشدار نمی‌دهد', async () => {
    const h = harness({ form: { settings: daily(9) } });
    expect(await h.service.run(NOON)).toBe(1);
    // دورِ دوم همان روز: lastAlertKey ست شده، پس دیگر نمی‌فرستد.
    expect(await h.service.run(NOON)).toBe(0);
    expect(h.sent).toHaveLength(1);
  });

  it('کلیدِ دوره را در settings فرم ذخیره می‌کند', async () => {
    const h = harness({ form: { settings: daily(9) } });
    await h.service.run(NOON);
    const checklist = h.saved.at(-1)!.settings.checklist as {
      lastAlertKey: string;
    };
    expect(checklist.lastAlertKey).toBe('D-2026-10-26');
  });

  it('فرمِ بدون بخش هشدار نمی‌دهد (مخاطبی ندارد)', async () => {
    const h = harness({ form: { departmentId: null, settings: daily(9) } });
    expect(await h.service.run(NOON)).toBe(0);
  });

  it('چک‌لیستِ خاموش نادیده گرفته می‌شود', async () => {
    const h = harness({
      form: { settings: { checklist: { enabled: false, cadence: 'daily', dueHour: 9 } } },
    });
    expect(await h.service.run(NOON)).toBe(0);
  });

  it('فرمِ بدون تنظیمِ چک‌لیست نادیده گرفته می‌شود', async () => {
    const h = harness({ form: { settings: {} } });
    expect(await h.service.run(NOON)).toBe(0);
    expect(h.saved).toHaveLength(0);
  });

  it('وقتی کار انجام شده، بدون ارسال هم دوره را علامت می‌زند تا کوئری تکرار نشود', async () => {
    const h = harness({ form: { settings: daily(3) }, completedSince: true });
    await h.service.run(NOON); // موعد ۳ گذشته، ولی ثبت شده
    const checklist = h.saved.at(-1)!.settings.checklist as {
      lastAlertKey: string;
    };
    expect(checklist.lastAlertKey).toBe('D-2026-10-26');
  });

  it('هفتگی: کلیدِ دوره با پیشوندِ W است', async () => {
    const h = harness({
      form: { settings: { checklist: { enabled: true, cadence: 'weekly', dueHour: 0, weekday: 0 } } },
    });
    // شنبه‌ی همین هفته + ساعت ۰؛ ظهرِ دوشنبه قطعا بعد از موعد است.
    expect(await h.service.run(NOON)).toBe(1);
    const checklist = h.saved.at(-1)!.settings.checklist as {
      lastAlertKey: string;
    };
    expect(checklist.lastAlertKey).toMatch(/^W-\d{4}-\d{2}-\d{2}$/);
  });

  it('صبح زود، پیش از موعدِ ظهر، ساکت می‌ماند', async () => {
    const h = harness({ form: { settings: daily(9) } }); // موعد ۹، الان ۶ صبح
    expect(await h.service.run(MORNING)).toBe(0);
  });
});
