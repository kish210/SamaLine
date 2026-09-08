jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import { TelegramService } from './telegram.service';
import { TelegramApi } from './telegram-api';
import type { TelegramIntegrationEntity } from '../database/entities/telegram-integration.entity';
import type { TelegramRecipientEntity } from '../database/entities/telegram-recipient.entity';

const BOT: Partial<TelegramIntegrationEntity> = {
  id: 'bot-1',
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
    chatId: '-100999',
    label: 'مدیر هتل',
    scoreThreshold: null,
    isActive: true,
    ...over,
  };
}

/** مخزن‌های ساختگی؛ ردیف‌ها در حافظه‌اند و به‌روزرسانی‌ها ثبت می‌شوند. */
function build(
  bot: Partial<TelegramIntegrationEntity> | null,
  recipients: Array<Partial<TelegramRecipientEntity>>,
) {
  const updates: Array<Record<string, unknown>> = [];
  const service = new TelegramService(
    {
      findOne: async () => bot,
      create: (v: unknown) => v,
      save: async (v: unknown) => v,
      delete: async () => undefined,
    } as never,
    {
      // سرویس با آرایه‌ی where دو حالت «همین فرم» و «همه‌ی فرم‌ها» را
      // با هم می‌خواهد؛ اینجا هر دو از یک فهرست برمی‌گردند.
      find: async () => recipients,
      findOne: async () => recipients[0] ?? null,
      create: (v: unknown) => v,
      save: async (v: unknown) => v,
      update: async (_w: unknown, patch: Record<string, unknown>) => {
        updates.push(patch);
      },
      delete: async () => undefined,
    } as never,
    // مخزن فضای کاری و سوپرادمین فقط برای assertAccess لازم‌اند؛ تست‌های
    // این فایل مستقیم سرویس را صدا می‌زنند، پس دسترسی جای دیگری بررسی شده.
    { findOne: async () => ({ id: 'w1', organizationId: 'org-1' }) } as never,
    { isSuperAdmin: async () => false } as never,
    new TelegramApi(),
  );
  return { service, updates };
}

const structure = {
  pages: [
    {
      id: 'p1',
      questions: [
        { id: 'name', type: 'short_text', title: 'نام' },
        { id: 'rate', type: 'rating', title: 'امتیاز' },
        { id: 'skipped', type: 'short_text', title: 'بی‌پاسخ' },
      ],
    },
  ],
};

const notify = (
  service: TelegramService,
  scores: Record<string, number> = {},
) =>
  service.notifyResponse({
    workspaceId: 'w1',
    formId: 'form-1',
    formTitle: 'نظرسنجی هتل',
    structure,
    answers: { name: 'پروین', rate: 8 },
    scores,
  });

describe('TelegramService', () => {
  const fetchMock = jest.fn();
  const original = globalThis.fetch;

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });
    globalThis.fetch = fetchMock as never;
  });

  afterAll(() => {
    globalThis.fetch = original;
  });

  const bodyOf = (call: number) =>
    JSON.parse(fetchMock.mock.calls[call][1].body as string);

  it('پیام را با عنوان سوال‌ها می‌سازد و سوال بی‌پاسخ را نمی‌آورد', async () => {
    const { service } = build(BOT, [recipient()]);
    await notify(service, { 'رضایت کلی': 8 });

    const body = bodyOf(0);
    expect(body.chat_id).toBe('-100999');
    expect(body.text).toContain('نظرسنجی هتل');
    expect(body.text).toContain('<b>نام:</b> پروین');
    expect(body.text).toContain('رضایت کلی');
    expect(body.text).not.toContain('بی‌پاسخ');
  });

  it('به همه‌ی مقصدهای آن فرم می‌فرستد', async () => {
    const { service } = build(BOT, [
      recipient({ id: 'r1', chatId: '-100111' }),
      recipient({ id: 'r2', chatId: '-100222' }),
    ]);
    await notify(service);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect([bodyOf(0).chat_id, bodyOf(1).chat_id].sort()).toEqual([
      '-100111',
      '-100222',
    ]);
  });

  it('مقصد غیرفعال پیام نمی‌گیرد', async () => {
    const { service } = build(BOT, [
      recipient({ id: 'r1', chatId: '-100111', isActive: false }),
      recipient({ id: 'r2', chatId: '-100222' }),
    ]);
    await notify(service);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(bodyOf(0).chat_id).toBe('-100222');
  });

  it('آستانه‌ی امتیاز برای هر مقصد جدا اعمال می‌شود', async () => {
    const { service } = build(BOT, [
      // فقط این مدیر پاسخ‌های ناراضی را می‌خواهد.
      recipient({ id: 'r1', chatId: '-100111', scoreThreshold: 5 }),
      recipient({ id: 'r2', chatId: '-100222' }),
    ]);

    await notify(service, { 'رضایت کلی': 8 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(bodyOf(0).chat_id).toBe('-100222');

    fetchMock.mockClear();
    await notify(service, { 'رضایت کلی': 3 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('ربات غیرفعال هیچ درخواستی نمی‌فرستد', async () => {
    const { service } = build({ ...BOT, isActive: false }, [recipient()]);
    await notify(service);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('بدون مقصد هیچ درخواستی نمی‌فرستد', async () => {
    const { service } = build(BOT, []);
    await notify(service);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('توکن ربات در نشانی می‌آید نه در متن پیام', async () => {
    const { service } = build(BOT, [recipient()]);
    await notify(service);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/bottoken-123/sendMessage');
    expect(init.body).not.toContain('token-123');
  });

  it('خطای تلگرام ثبت پاسخ را نمی‌شکند و روی مقصد ذخیره می‌شود', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ ok: false, description: 'Unauthorized' }),
    });
    const { service, updates } = build(BOT, [recipient()]);

    // نباید throw کند؛ این از داخل مسیر ثبت پاسخ صدا زده می‌شود.
    await expect(notify(service)).resolves.toBeUndefined();
    expect(updates[0]).toEqual({ lastError: 'Unauthorized' });
  });

  it('قطع شدن شبکه هم پاسخ را نمی‌شکند', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    const { service, updates } = build(BOT, [recipient()]);
    await expect(notify(service)).resolves.toBeUndefined();
    expect(updates[0]).toEqual({ lastError: 'network down' });
  });

  it('تگ‌های HTML داخل پاسخ به‌عنوان تگ تفسیر نمی‌شوند', async () => {
    const { service } = build(BOT, [recipient()]);
    await service.notifyResponse({
      workspaceId: 'w1',
      formId: 'form-1',
      formTitle: 'فرم',
      structure,
      answers: { name: '<b>حمله</b>' },
      scores: {},
    });
    expect(bodyOf(0).text).toContain('&lt;b&gt;حمله&lt;/b&gt;');
  });

  it('توکن نامعتبر همان لحظه رد می‌شود، نه با نرسیدن پیام‌ها', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: false, description: 'Unauthorized' }),
    });
    const { service } = build(null, []);
    await expect(
      service.saveBot('w1', { botToken: 'bad-token' }),
    ).rejects.toThrow('توکن ربات معتبر نیست');
  });

  it('وضعیت ربات توکن را برنمی‌گرداند', async () => {
    const { service } = build(BOT, []);
    const status = await service.getBot('w1');
    expect(status.configured).toBe(true);
    expect(status).not.toHaveProperty('botToken');
  });

  it('بدون ربات یعنی «متصل نشده»', async () => {
    const { service } = build(null, []);
    expect(await service.getBot('w1')).toMatchObject({ configured: false });
  });

  describe('جداسازی مستاجر', () => {
    /**
     * `workspaceId` از خود درخواست می‌آید. بدون این بررسی، هر کاربر
     * واردشده می‌توانست با حدس زدن شناسه توکن ربات سازمان دیگری را عوض کند
     * یا پاسخ‌های فرم‌های آن سازمان را به گفتگوی خودش هدایت کند.
     */
    const serviceFor = (
      workspace: { id: string; organizationId: string } | null,
      isSuperAdmin = false,
    ) =>
      new TelegramService(
        { findOne: async () => null } as never,
        { find: async () => [] } as never,
        { findOne: async () => workspace } as never,
        { isSuperAdmin: async () => isSuperAdmin } as never,
        new TelegramApi(),
      );

    const user = { sub: 'u1', organizationId: 'org-1' };

    it('فضای کاری سازمان خودی را می‌پذیرد', async () => {
      const service = serviceFor({ id: 'w1', organizationId: 'org-1' });
      await expect(service.assertAccess('w1', user)).resolves.toBeUndefined();
    });

    it('فضای کاری سازمان دیگر را رد می‌کند', async () => {
      const service = serviceFor({ id: 'w9', organizationId: 'org-2' });
      await expect(service.assertAccess('w9', user)).rejects.toThrow(
        'به این فضای کاری دسترسی ندارید',
      );
    });

    it('فضای کاری ناموجود را رد می‌کند', async () => {
      const service = serviceFor(null);
      await expect(service.assertAccess('ناموجود', user)).rejects.toThrow(
        'به این فضای کاری دسترسی ندارید',
      );
    });

    it('سوپرادمین به همه‌ی فضاهای کاری دسترسی دارد', async () => {
      const service = serviceFor({ id: 'w9', organizationId: 'org-2' }, true);
      await expect(service.assertAccess('w9', user)).resolves.toBeUndefined();
    });
  });
});
