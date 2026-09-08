jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import { TelegramBotService } from './telegram-bot.service';
import type { TelegramApi } from './telegram-api';
import type { TelegramLinkCodeEntity } from '../database/entities/telegram-link-code.entity';
import type { TelegramRecipientEntity } from '../database/entities/telegram-recipient.entity';

const BOT = {
  id: 'bot-1',
  workspaceId: 'w1',
  botToken: 'token-123',
  botUsername: 'SamaLine_bot',
  webhookToken: 'hook-abc',
  isActive: true,
};

function futureCode(
  over: Partial<TelegramLinkCodeEntity> = {},
): Partial<TelegramLinkCodeEntity> {
  return {
    id: 'c1',
    code: 'ABCD2345',
    workspaceId: 'w1',
    formId: 'form-1',
    label: 'مدیر هتل',
    expiresAt: new Date(Date.now() + 60_000),
    maxUses: 1,
    useCount: 0,
    usedAt: null,
    ...over,
  };
}

interface Harness {
  service: TelegramBotService;
  sent: Array<{ chatId: string; text: string }>;
  saved: Array<Record<string, unknown>>;
  updates: Array<Record<string, unknown>>;
  deletes: Array<Record<string, unknown>>;
  codeUpdates: Array<Record<string, unknown>>;
  digestSends: Array<{ chatId: string }>;
}

function harness(options: {
  code?: Partial<TelegramLinkCodeEntity> | null;
  recipients?: Array<Partial<TelegramRecipientEntity>>;
}): Harness {
  const sent: Harness['sent'] = [];
  const saved: Harness['saved'] = [];
  const updates: Harness['updates'] = [];
  const deletes: Harness['deletes'] = [];
  const codeUpdates: Harness['codeUpdates'] = [];
  const digestSends: Array<{ chatId: string }> = [];
  const recipients = options.recipients ?? [];

  const api = {
    send: async (_token: string, chatId: string, text: string) => {
      sent.push({ chatId, text });
      return { ok: true as const };
    },
  } as unknown as TelegramApi;

  const service = new TelegramBotService(
    {
      // جست‌وجو واقعا بر اساس توکن انجام می‌شود؛ اگر مخزن هر توکنی را
      // بپذیرد، تست «توکن ناشناخته» چیزی را ثابت نمی‌کند.
      findOne: async (options_: { where: { webhookToken: string } }) =>
        options_.where.webhookToken === BOT.webhookToken ? BOT : null,
    } as never,
    {
      findOne: async () => recipients[0] ?? null,
      find: async () => recipients,
      create: (v: unknown) => v,
      save: async (v: Record<string, unknown>) => {
        saved.push(v);
        return v;
      },
      update: async (where: unknown, patch: Record<string, unknown>) => {
        updates.push(patch);
        return { affected: recipients.length };
      },
      delete: async (where: Record<string, unknown>) => {
        deletes.push(where);
        return { affected: recipients.length };
      },
    } as never,
    {
      findOne: async () => (options.code === undefined ? null : options.code),
      save: async (v: unknown) => v,
      create: (v: unknown) => v,
      update: async (_w: unknown, patch: Record<string, unknown>) => {
        codeUpdates.push(patch);
        // شمارنده روی همان ردیف اعمال می‌شود، وگرنه تست «ظرفیت پر شد»
        // همیشه از صفر شروع می‌کند و چیزی را ثابت نمی‌کند.
        if (options.code && typeof patch.useCount === "number") {
          options.code.useCount = patch.useCount;
        }
      },
      delete: async () => undefined,
    } as never,
    { findOne: async () => ({ id: 'form-1', title: 'نظرسنجی هتل' }) } as never,
    api,
    {
      sendNow: async () => {
        digestSends.push({ chatId: 'called' });
        return options.recipients?.length ? 1 : 0;
      },
    } as never,
  );

  return { service, sent, saved, updates, deletes, codeUpdates, digestSends };
}

const message = (text: string, chatId = '555') => ({
  message: { text, chat: { id: chatId, first_name: 'محمد' } },
});

describe('TelegramBotService — فرمان‌های ربات', () => {
  it('کد معتبر گفتگو را به فرم وصل می‌کند و کد را مصرف‌شده می‌کند', async () => {
    const h = harness({ code: futureCode(), recipients: [] });
    await h.service.handleUpdate('hook-abc', message('/start ABCD2345'));

    expect(h.saved[0]).toMatchObject({
      workspaceId: 'w1',
      formId: 'form-1',
      chatId: '555',
      isActive: true,
    });
    // کد یک‌بارمصرف است؛ بدون این، هر کسی که کد را ببیند می‌تواند وصل شود.
    expect(h.codeUpdates[0]).toHaveProperty('usedAt');
    expect(h.sent[0].text).toContain('نظرسنجی هتل');
  });

  it('کد بدون اسلش هم پذیرفته می‌شود', async () => {
    // کاربر معمولا کد را کپی می‌کند و بدون /start می‌فرستد.
    const h = harness({ code: futureCode(), recipients: [] });
    await h.service.handleUpdate('hook-abc', message('ABCD2345'));
    expect(h.saved).toHaveLength(1);
  });

  it('کد منقضی رد می‌شود', async () => {
    const h = harness({
      code: futureCode({ expiresAt: new Date(Date.now() - 1000) }),
    });
    await h.service.handleUpdate('hook-abc', message('/start ABCD2345'));

    expect(h.saved).toHaveLength(0);
    expect(h.sent[0].text).toContain('نامعتبر یا منقضی');
  });

  it('کد تک‌نفره پس از یک استفاده دیگر کار نمی‌کند', async () => {
    // مبنا شمارنده است نه تاریخ مصرف، چون کد گروهی چند بار مصرف می‌شود.
    const h = harness({
      code: futureCode({ maxUses: 1, useCount: 1, usedAt: new Date() }),
    });
    await h.service.handleUpdate('hook-abc', message('/start ABCD2345'));
    expect(h.saved).toHaveLength(0);
    expect(h.sent[0].text).toContain('ظرفیت این کد پر شده');
  });

  it('کد فضای کاری دیگر روی این ربات کار نمی‌کند', async () => {
    /*
     * بدون این بررسی، کدِ یک مجموعه را می‌شد به ربات مجموعه‌ی دیگری داد و
     * مقصدی ساخت که ربات دیگری به آن پیام می‌دهد.
     */
    const h = harness({ code: futureCode({ workspaceId: 'w-other' }) });
    await h.service.handleUpdate('hook-abc', message('/start ABCD2345'));

    expect(h.saved).toHaveLength(0);
    expect(h.sent[0].text).toContain('ربات دیگری');
  });

  it('توکن وبهوک ناشناخته هیچ کاری نمی‌کند', async () => {
    const h = harness({ code: futureCode() });
    await h.service.handleUpdate('توکن-غلط', message('/start ABCD2345'));

    expect(h.saved).toHaveLength(0);
    expect(h.sent).toHaveLength(0);
  });

  it('فرمان ناشناخته راهنما می‌دهد، نه خطا', async () => {
    const h = harness({ recipients: [] });
    await h.service.handleUpdate('hook-abc', message('سلام'));
    expect(h.sent[0].text).toContain('فرمان‌ها');
  });

  it('/weekly گزارش هفتگی را روشن می‌کند', async () => {
    const h = harness({ recipients: [{ id: 'r1' }] });
    await h.service.handleUpdate('hook-abc', message('/weekly'));

    expect(h.updates[0]).toMatchObject({ digest: 'weekly' });
    // مبدأ شمارش از حالا، وگرنه اولین گزارش بلافاصله می‌رفت.
    expect(h.updates[0]).toHaveProperty('lastDigestAt');
    expect(h.sent[0].text).toContain('هفتگی');
  });

  it('/mute فقط اعلان هر پاسخ را خاموش می‌کند', async () => {
    const h = harness({ recipients: [{ id: 'r1' }] });
    await h.service.handleUpdate('hook-abc', message('/mute'));

    expect(h.updates[0]).toEqual({ notifyOnResponse: false });
    expect(h.sent[0].text).toContain('گزارش دوره‌ای دست‌نخورده');
  });

  it('/stop گفتگو را از همه‌ی فرم‌ها قطع می‌کند', async () => {
    const h = harness({ recipients: [{ id: 'r1' }] });
    await h.service.handleUpdate('hook-abc', message('/stop'));

    expect(h.deletes[0]).toEqual({ workspaceId: 'w1', chatId: '555' });
  });

  it('فرمان با نام ربات (@bot) هم شناخته می‌شود', async () => {
    // در گروه‌ها تلگرام فرمان را به شکل /weekly@SamaLine_bot می‌فرستد.
    const h = harness({ recipients: [{ id: 'r1' }] });
    await h.service.handleUpdate('hook-abc', message('/weekly@SamaLine_bot'));
    expect(h.updates[0]).toMatchObject({ digest: 'weekly' });
  });

  it('به‌روزرسانی بدون متن نادیده گرفته می‌شود', async () => {
    const h = harness({ recipients: [] });
    await h.service.handleUpdate('hook-abc', { message: { chat: { id: '5' } } });
    expect(h.sent).toHaveLength(0);
  });

  it('کد ساخته‌شده حروف مبهم ندارد', async () => {
    const h = harness({});
    const { code } = await h.service.createLinkCode({
      workspaceId: 'w1',
      formId: null,
      label: 'مدیر',
    });
    // O/0 و I/1/l هنگام خواندن از صفحه و تایپ در تلگرام اشتباه می‌شوند.
    expect(code).not.toMatch(/[O0Il1]/);
    expect(code).toHaveLength(8);
  });

  it('/report گزارش فوری می‌فرستد و پیام اضافه نمی‌دهد', async () => {
    const h = harness({ recipients: [{ id: 'r1' }] });
    await h.service.handleUpdate('hook-abc', message('/report'));

    expect(h.digestSends).toHaveLength(1);
    // خودِ گزارش رفته؛ یک «باشه» اضافه فقط شلوغی است.
    expect(h.sent).toHaveLength(0);
  });

  it('/report روی گفتگوی وصل‌نشده توضیح می‌دهد', async () => {
    const h = harness({ recipients: [] });
    await h.service.handleUpdate('hook-abc', message('/report'));
    expect(h.sent[0].text).toContain('وصل نیست');
  });

  describe('کد گروهی', () => {
    it('یک کد چند مدیر را به همان فرم وصل می‌کند', async () => {
      const code = futureCode({ maxUses: 3, useCount: 0 });
      const h = harness({ code, recipients: [] });

      await h.service.handleUpdate('hook-abc', message(code.code!, '111'));
      await h.service.handleUpdate('hook-abc', message(code.code!, '222'));

      expect(h.saved.map((r) => r.chatId)).toEqual(['111', '222']);
      expect(h.saved.every((r) => r.formId === 'form-1')).toBe(true);
    });

    it('پس از پر شدن ظرفیت، کد کار نمی‌کند', async () => {
      const code = futureCode({ maxUses: 2, useCount: 2 });
      const h = harness({ code, recipients: [] });

      await h.service.handleUpdate('hook-abc', message(code.code!, '333'));

      expect(h.saved).toHaveLength(0);
      expect(h.sent[0].text).toContain('ظرفیت این کد پر شده');
    });

    it('ظرفیت باقی‌مانده به کاربر گفته می‌شود', async () => {
      const code = futureCode({ maxUses: 3, useCount: 0 });
      const h = harness({ code, recipients: [] });
      await h.service.handleUpdate('hook-abc', message(code.code!, '111'));
      expect(h.sent[0].text).toContain('2 نفر');
    });

    it('کد بی‌شمار (null) هیچ‌وقت پر نمی‌شود', async () => {
      const code = futureCode({ maxUses: null, useCount: 99 });
      const h = harness({ code, recipients: [] });
      await h.service.handleUpdate('hook-abc', message(code.code!, '444'));
      expect(h.saved).toHaveLength(1);
    });
  });
});
