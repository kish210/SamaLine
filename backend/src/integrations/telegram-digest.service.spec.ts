jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import { TelegramDigestService } from './telegram-digest.service';
import type { AnalyticsService } from '../reports/analytics.service';
import type { TelegramApi } from './telegram-api';
import type { TelegramRecipientEntity } from '../database/entities/telegram-recipient.entity';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-09-08T09:00:00Z');

const BOT = {
  workspaceId: 'w1',
  botToken: 'token-123',
  isActive: true,
};

function recipient(
  over: Partial<TelegramRecipientEntity> = {},
): Partial<TelegramRecipientEntity> {
  return {
    id: 'r1',
    workspaceId: 'w1',
    formId: 'form-1',
    chatId: '555',
    isActive: true,
    digest: 'weekly',
    lastDigestAt: new Date(NOW.getTime() - 8 * DAY),
    createdAt: new Date(NOW.getTime() - 30 * DAY),
    ...over,
  };
}

const ANALYTICS = {
  totalResponses: 4,
  range: { from: null, to: null, fromJalali: null, toJalali: null },
  questions: [
    { id: 'a', title: 'پذیرش', average: 9, answered: 4 },
    { id: 'b', title: 'رستوران', average: 3, answered: 4 },
    { id: 'c', title: 'اتاق', average: 5, answered: 4 },
    { id: 'd', title: 'استخر', average: 7, answered: 4 },
  ],
  scores: [{ key: 'رضایت کلی', average: 6, count: 4, maxScore: 10, rate: 60 }],
  trend: [],
};

function harness(options: {
  recipients: Array<Partial<TelegramRecipientEntity>>;
  bot?: unknown;
  sendFails?: string;
  analytics?: unknown;
}) {
  const sent: Array<{ chatId: string; text: string }> = [];
  const updates: Array<Record<string, unknown>> = [];

  const api = {
    send: async (_t: string, chatId: string, text: string) => {
      sent.push({ chatId, text });
      return options.sendFails
        ? { ok: false as const, error: options.sendFails }
        : { ok: true as const };
    },
  } as unknown as TelegramApi;

  const service = new TelegramDigestService(
    {
      find: async () => options.recipients,
      update: async (_w: unknown, patch: Record<string, unknown>) => {
        updates.push(patch);
      },
    } as never,
    { findOne: async () => options.bot ?? BOT } as never,
    {
      find: async () => [{ id: 'form-1', title: 'نظرسنجی هتل' }],
    } as never,
    {
      forForm: async () => options.analytics ?? ANALYTICS,
    } as unknown as AnalyticsService,
    api,
  );

  return { service, sent, updates };
}

describe('TelegramDigestService', () => {
  it('مقصدی که موعدش رسیده گزارش می‌گیرد', async () => {
    const h = harness({ recipients: [recipient()] });
    expect(await h.service.run(NOW)).toBe(1);

    expect(h.sent[0].chatId).toBe('555');
    expect(h.sent[0].text).toContain('گزارش هفتگی');
    expect(h.sent[0].text).toContain('نظرسنجی هتل');
    expect(h.sent[0].text).toContain('رضایت کلی');
  });

  it('پیش از رسیدن موعد چیزی نمی‌فرستد', async () => {
    const h = harness({
      recipients: [
        recipient({ lastDigestAt: new Date(NOW.getTime() - 2 * DAY) }),
      ],
    });
    expect(await h.service.run(NOW)).toBe(0);
    expect(h.sent).toHaveLength(0);
  });

  it('دوره‌ی ماهانه با هفت روز فاصله هنوز موعدش نرسیده', async () => {
    const h = harness({
      recipients: [
        recipient({
          digest: 'monthly',
          lastDigestAt: new Date(NOW.getTime() - 8 * DAY),
        }),
      ],
    });
    expect(await h.service.run(NOW)).toBe(0);
  });

  it('بدون ارسال قبلی، مبدأ تاریخ ساخت مقصد است', async () => {
    const h = harness({
      recipients: [
        recipient({
          lastDigestAt: null,
          createdAt: new Date(NOW.getTime() - 10 * DAY),
        }),
      ],
    });
    expect(await h.service.run(NOW)).toBe(1);
  });

  it('مقصد تازه‌ساخته بلافاصله گزارش نمی‌گیرد', async () => {
    const h = harness({
      recipients: [
        recipient({ lastDigestAt: null, createdAt: new Date(NOW.getTime()) }),
      ],
    });
    expect(await h.service.run(NOW)).toBe(0);
  });

  it('فقط سه سوال با کمترین امتیاز می‌آید', async () => {
    /*
     * مدیر دنبال «کجا بد بودیم» است؛ فهرست کامل سوال‌ها هم پیام را از حد
     * تلگرام رد می‌کند هم چیزی به او نمی‌گوید.
     */
    const h = harness({ recipients: [recipient()] });
    await h.service.run(NOW);

    const text = h.sent[0].text;
    expect(text).toContain('رستوران');
    expect(text).toContain('اتاق');
    expect(text).toContain('استخر');
    // بالاترین امتیاز نباید در «کمترین امتیازها» باشد.
    expect(text).not.toContain('پذیرش');
  });

  it('ربات غیرفعال گزارش نمی‌فرستد', async () => {
    const h = harness({
      recipients: [recipient()],
      bot: { ...BOT, isActive: false },
    });
    expect(await h.service.run(NOW)).toBe(0);
  });

  it('بازه‌ی بدون پاسخ هم گزارش می‌گیرد، با پیام صریح', async () => {
    // سکوت کامل، از «هیچ پاسخی نبود» بدتر است: مدیر فکر می‌کند سامانه خراب است.
    const h = harness({
      recipients: [recipient()],
      analytics: { ...ANALYTICS, totalResponses: 0, questions: [], scores: [] },
    });
    await h.service.run(NOW);
    expect(h.sent[0].text).toContain('پاسخی ثبت نشد');
  });

  it('شکست ارسال هم موعد را جلو می‌برد و خطا را ذخیره می‌کند', async () => {
    /*
     * وگرنه یک گفتگوی مسدودشده هر نیم‌ساعت دوباره تلاش می‌شود و تلگرام
     * ربات را محدود می‌کند.
     */
    const h = harness({
      recipients: [recipient()],
      sendFails: 'bot was blocked by the user',
    });
    expect(await h.service.run(NOW)).toBe(0);

    expect(h.updates[0]).toMatchObject({
      lastError: 'bot was blocked by the user',
    });
    expect(h.updates[0]).toHaveProperty('lastDigestAt');
  });

  it('خطای ساخت گزارش کل اجرا را نمی‌شکند', async () => {
    const h = harness({ recipients: [recipient()] });
    // تجمیع خطا می‌دهد ولی پیام باید با یادداشت خطا برود.
    (h.service as unknown as { analytics: AnalyticsService }).analytics = {
      forForm: async () => {
        throw new Error('db down');
      },
    } as unknown as AnalyticsService;

    await expect(h.service.run(NOW)).resolves.toBe(1);
    expect(h.sent[0].text).toContain('گزارش این فرم ساخته نشد');
  });
});
