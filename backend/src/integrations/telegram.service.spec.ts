jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import { TelegramService } from './telegram.service';
import type { TelegramIntegrationEntity } from '../database/entities/telegram-integration.entity';

/** یک مخزن ساختگی با یک ردیف در حافظه. */
function repoWith(row: Partial<TelegramIntegrationEntity> | null) {
  const updates: Array<Record<string, unknown>> = [];
  return {
    updates,
    repo: {
      findOne: async () => row,
      update: async (_where: unknown, patch: Record<string, unknown>) => {
        updates.push(patch);
      },
      create: (value: unknown) => value,
      save: async (value: unknown) => value,
      delete: async () => undefined,
    } as never,
  };
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

  const active = {
    id: 'row-1',
    botToken: 'token-123',
    chatId: '-100999',
    isActive: true,
    notifyOnResponse: true,
    scoreThreshold: null,
  };

  const notify = (
    service: TelegramService,
    scores: Record<string, number> = {},
  ) =>
    service.notifyResponse({
      workspaceId: 'w1',
      formTitle: 'نظرسنجی هتل',
      structure,
      answers: { name: 'پروین', rate: 8 },
      scores,
    });

  it('پیام را با عنوان سوال‌ها می‌سازد و سوال بی‌پاسخ را نمی‌آورد', async () => {
    const { repo } = repoWith(active);
    await notify(new TelegramService(repo), { 'رضایت کلی': 8 });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.chat_id).toBe('-100999');
    expect(body.text).toContain('نظرسنجی هتل');
    expect(body.text).toContain('<b>نام:</b> پروین');
    expect(body.text).toContain('رضایت کلی');
    expect(body.text).not.toContain('بی‌پاسخ');
  });

  it('توکن ربات در نشانی می‌آید نه در متن پیام', async () => {
    const { repo } = repoWith(active);
    await notify(new TelegramService(repo));
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/bottoken-123/sendMessage');
    expect(init.body).not.toContain('token-123');
  });

  it('اتصال غیرفعال هیچ درخواستی نمی‌فرستد', async () => {
    const { repo } = repoWith({ ...active, isActive: false });
    await notify(new TelegramService(repo));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('با آستانه‌ی امتیاز، پاسخ راضی فرستاده نمی‌شود', async () => {
    const { repo } = repoWith({ ...active, scoreThreshold: 5 });
    const service = new TelegramService(repo);

    await notify(service, { 'رضایت کلی': 8 });
    expect(fetchMock).not.toHaveBeenCalled();

    await notify(service, { 'رضایت کلی': 3 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('خطای تلگرام ثبت پاسخ را نمی‌شکند و در ردیف ذخیره می‌شود', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ ok: false, description: 'Unauthorized' }),
    });
    const { repo, updates } = repoWith(active);

    // نباید throw کند؛ این از داخل مسیر ثبت پاسخ صدا زده می‌شود.
    await expect(notify(new TelegramService(repo))).resolves.toBeUndefined();
    expect(updates[0]).toEqual({ lastError: 'Unauthorized' });
  });

  it('قطع شدن شبکه هم پاسخ را نمی‌شکند', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    const { repo, updates } = repoWith(active);
    await expect(notify(new TelegramService(repo))).resolves.toBeUndefined();
    expect(updates[0]).toEqual({ lastError: 'network down' });
  });

  it('تگ‌های HTML داخل پاسخ به‌عنوان تگ تفسیر نمی‌شوند', async () => {
    const { repo } = repoWith(active);
    await new TelegramService(repo).notifyResponse({
      workspaceId: 'w1',
      formTitle: 'فرم',
      structure,
      answers: { name: '<b>حمله</b>' },
      scores: {},
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.text).toContain('&lt;b&gt;حمله&lt;/b&gt;');
  });

  it('توکن ذخیره‌شده با ذخیره‌ی تنظیمات بدون توکن پاک نمی‌شود', async () => {
    const { repo } = repoWith(active);
    const service = new TelegramService(repo);
    const saved = await service.saveSettings('w1', { chatId: '-100888' });
    expect(saved.configured).toBe(true);
    // getSettings توکن را برنمی‌گرداند؛ نبودنش در خروجی عمدی است.
    expect(saved).not.toHaveProperty('botToken');
  });

  it('تنظیمات نداشته یعنی «متصل نشده»', async () => {
    const { repo } = repoWith(null);
    expect(await new TelegramService(repo).getSettings('w1')).toMatchObject({
      configured: false,
    });
  });
});
