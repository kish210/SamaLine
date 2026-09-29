jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import { ReminderService } from './reminder.service';
import { ResponseStatus } from '../database/entities/response.entity';
import type { OutboundMessage } from '../messaging/messaging.types';

const HOUR = 60 * 60 * 1000;
const NOW = new Date('2026-09-14T12:00:00Z');

/**
 * یک پاسخ ناقص می‌سازد که به‌طور پیش‌فرض «واجد شرایط یادآوری» است: هشت ساعت
 * پیش شروع شده، هنوز ثبت نشده، یادآوری‌نشده، و یک موبایل در پاسخ‌ها دارد.
 * هر تست فقط همان چیزی را که می‌خواهد نقض کند بازنویسی می‌کند.
 */
function partial(over: Record<string, unknown> = {}) {
  return {
    id: 'resp-1',
    publicationId: 'pub-1',
    formVersionId: 'fv-1',
    respondentKey: 'user-1',
    status: ResponseStatus.PARTIAL,
    submittedAt: null,
    startedAt: new Date(NOW.getTime() - 8 * HOUR),
    meta: {},
    answers: { q1: 'علی', q2: '09121234567' },
    ...over,
  };
}

function harness(options: {
  partials: Array<Record<string, unknown>>;
  reminders?: Record<string, unknown>;
  completedExists?: boolean;
  sendResult?: 'sent' | 'failed';
}) {
  const sent: OutboundMessage[] = [];
  const saved: Array<{ meta: Record<string, unknown> }> = [];

  const responseRepo = {
    find: async () => options.partials,
    findOne: async ({ where }: { where: { status?: string } }) =>
      where.status === ResponseStatus.COMPLETED
        ? options.completedExists
          ? { id: 'done-1' }
          : null
        : null,
    save: async (row: Record<string, unknown>) => {
      saved.push(row as { meta: Record<string, unknown> });
      return row;
    },
  };

  const publicationRepo = {
    findOne: async () => ({ id: 'pub-1', formId: 'form-1', token: 'tok-abc' }),
  };

  const formRepo = {
    findOne: async () => ({
      id: 'form-1',
      title: 'نظرسنجی هتل',
      settings: { reminders: options.reminders ?? { enabled: true } },
    }),
  };

  const messaging = {
    send: async (message: OutboundMessage) => {
      sent.push(message);
      return {
        status: options.sendResult ?? 'sent',
        providerMessage: null,
      };
    },
  };

  const service = new ReminderService(
    responseRepo as never,
    publicationRepo as never,
    formRepo as never,
    messaging as never,
  );

  return { service, sent, saved };
}

describe('ReminderService', () => {
  const OLD_URL = process.env.PUBLIC_URL;
  beforeAll(() => {
    process.env.PUBLIC_URL = 'https://i.kishvip.com';
  });
  afterAll(() => {
    process.env.PUBLIC_URL = OLD_URL;
  });

  it('برای فرم رهاشده‌ی روشن، پیامک با لینک ادامه می‌فرستد', async () => {
    const h = harness({ partials: [partial()] });
    expect(await h.service.run(NOW)).toBe(1);
    expect(h.sent).toHaveLength(1);
    expect(h.sent[0].channel).toBe('sms');
    expect(h.sent[0].recipient).toBe('09121234567');
    // لینک باید توکن انتشار و کلید پاسخ‌دهنده را داشته باشد تا از همان‌جا ادامه دهد.
    expect(h.sent[0].body).toContain(
      'https://i.kishvip.com/f/tok-abc?r=user-1',
    );
  });

  it('پاسخ را «یادآوری‌شده» علامت می‌زند تا دوباره نرود', async () => {
    const h = harness({ partials: [partial()] });
    await h.service.run(NOW);
    expect(h.saved[0].meta.remindedAt).toBeTruthy();
    expect(h.saved[0].meta.reminderChannel).toBe('sms');
  });

  it('اگر قبلا یادآوری شده، دوباره نمی‌فرستد', async () => {
    const h = harness({
      partials: [partial({ meta: { remindedAt: '2026-09-13T00:00:00Z' } })],
    });
    expect(await h.service.run(NOW)).toBe(0);
    expect(h.sent).toHaveLength(0);
  });

  it('اگر فرم یادآوری را روشن نکرده، هیچ نمی‌فرستد', async () => {
    const h = harness({ partials: [partial()], reminders: { enabled: false } });
    expect(await h.service.run(NOW)).toBe(0);
    expect(h.sent).toHaveLength(0);
  });

  it('اگر هنوز به تاخیرِ فرم نرسیده، صبر می‌کند', async () => {
    // فرم تاخیر ۲۴ ساعته دارد ولی فقط ۸ ساعت گذشته.
    const h = harness({
      partials: [partial()],
      reminders: { enabled: true, delayHours: 24 },
    });
    expect(await h.service.run(NOW)).toBe(0);
  });

  it('فرمی که همان پاسخ‌دهنده بعدا کاملش کرده، یادآوری نمی‌گیرد', async () => {
    const h = harness({ partials: [partial()], completedExists: true });
    expect(await h.service.run(NOW)).toBe(0);
    expect(h.sent).toHaveLength(0);
    // ولی علامت می‌خورد تا هر دور دوباره کوئریِ completed را نزند.
    expect(h.saved[0].meta.remindedAt).toBeTruthy();
  });

  it('بدون راه تماس در پاسخ، چیزی نمی‌فرستد', async () => {
    const h = harness({
      partials: [partial({ answers: { q1: 'فقط اسم' } })],
    });
    expect(await h.service.run(NOW)).toBe(0);
  });

  it('اگر شماره نبود ولی ایمیل بود، ایمیل می‌فرستد', async () => {
    const h = harness({
      partials: [partial({ answers: { q1: 'سارا', q2: 'sara@example.com' } })],
    });
    expect(await h.service.run(NOW)).toBe(1);
    expect(h.sent[0].channel).toBe('email');
    expect(h.sent[0].recipient).toBe('sara@example.com');
    expect(h.sent[0].subject).toContain('نظرسنجی هتل');
  });

  it('کانالِ اجباری sms، با نبود موبایل چیزی نمی‌فرستد حتی اگر ایمیل باشد', async () => {
    const h = harness({
      partials: [partial({ answers: { q1: 'x', q2: 'a@b.com' } })],
      reminders: { enabled: true, channel: 'sms' },
    });
    expect(await h.service.run(NOW)).toBe(0);
  });

  it('موبایل با ارقام فارسی و +۹۸ را استاندارد می‌کند', async () => {
    const h = harness({
      partials: [partial({ answers: { q1: 'رضا', q2: '+98 912 000 1122' } })],
    });
    await h.service.run(NOW);
    expect(h.sent[0].recipient).toBe('09120001122');
  });

  it('پیام سفارشی با جای‌گذاری {form} و {link} پر می‌شود', async () => {
    const h = harness({
      partials: [partial()],
      reminders: {
        enabled: true,
        message: 'دوستِ عزیز، «{form}» را تمام کنید: {link}',
      },
    });
    await h.service.run(NOW);
    expect(h.sent[0].body).toBe(
      'دوستِ عزیز، «نظرسنجی هتل» را تمام کنید: https://i.kishvip.com/f/tok-abc?r=user-1',
    );
  });

  it('اگر فرم بیش از حد کهنه باشد، یادآوری نمی‌فرستد', async () => {
    const h = harness({
      partials: [partial({ startedAt: new Date(NOW.getTime() - 100 * HOUR) })],
    });
    // کوئری اصلی startedAt قدیمی را می‌آورد، ولی سقف سنی جلوی ارسال را می‌گیرد.
    expect(await h.service.run(NOW)).toBe(0);
  });
});
