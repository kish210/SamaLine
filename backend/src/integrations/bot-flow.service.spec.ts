jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import type { DataSource } from 'typeorm';
import {
  BotFlow,
  BotFlowSessionEntity,
} from '../database/entities/bot-flow-session.entity';
import { createTestDataSource } from '../testing/test-database';
import { BotFlowService, parseUserDate } from './bot-flow.service';

describe('parseUserDate — تاریخِ واردشده در ربات', () => {
  it('شمسی با ارقامِ فارسی', () => {
    // ۱۴۰۴/۰۱/۰۱ = ۲۱ مارس ۲۰۲۵؛ ۴×۳۱+۱۱ روز بعد.
    expect(parseUserDate('۱۴۰۴/۰۵/۱۲')).toBe('2025-08-03');
  });

  it('ارقامِ عربی و جداکننده‌ی خط تیره', () => {
    expect(parseUserDate('١٤٠٤-٠١-٠١')).toBe('2025-03-21');
  });

  it('میلادی هم پذیرفته می‌شود', () => {
    expect(parseUserDate('2026-01-05')).toBe('2026-01-05');
  });

  it('متنِ بی‌تاریخ null', () => {
    expect(parseUserDate('فردا')).toBeNull();
    expect(parseUserDate('1404/05')).toBeNull();
  });
});

describe('BotFlowService — کارهای چندمرحله‌ای در ربات', () => {
  let ds: DataSource;
  let service: BotFlowService;
  let requests: Array<Record<string, unknown>>;
  let leaves: Array<Record<string, unknown>>;
  let replies: Array<{ letterId: string; personnelId: string; body: string }>;
  let leaveError: unknown;

  const ORG = 'org-1';
  const PERSON = 'person-1';
  const CHAT = 'chat-1';
  const PLATFORM = 'bale';

  const say = (text: string) => service.handleMessage(CHAT, PLATFORM, text);
  const startFlow = (flow: BotFlow, contextId?: string) =>
    service.start({
      organizationId: ORG,
      personnelId: PERSON,
      chatId: CHAT,
      platform: PLATFORM,
      flow,
      contextId,
    });

  beforeEach(async () => {
    ds = await createTestDataSource();
    requests = [];
    leaves = [];
    replies = [];
    leaveError = null;
    service = new BotFlowService(
      ds.getRepository(BotFlowSessionEntity),
      {
        createRequest: async (_org: string, input: Record<string, unknown>) => {
          requests.push(input);
          return { number: 'MR-00001' };
        },
      } as never,
      {
        create: async (_org: string, input: Record<string, unknown>) => {
          if (leaveError) throw leaveError;
          leaves.push(input);
          return { number: 'LV-00001', days: 3 };
        },
      } as never,
      {
        reply: async (
          _org: string,
          personnelId: string,
          letterId: string,
          input: { body: string },
        ) => {
          replies.push({ letterId, personnelId, body: input.body });
          return { number: 'LT-00002' };
        },
      } as never,
    );
  });

  afterEach(async () => {
    await ds.destroy();
  });

  it('بدونِ کارِ باز null می‌دهد تا پیام به منوی عادی برود', async () => {
    expect(await say('سلام')).toBeNull();
  });

  it('اعلامِ خرابی: سه قدم، خطای ورودیِ کوتاه، رد کردنِ محل، ثبت با اولویت', async () => {
    const first = await startFlow(BotFlow.FAULT);
    expect(first.text).toContain('چه چیزی خراب است');

    // ورودیِ خیلی کوتاه رد می‌شود و همان پرسش تکرار می‌شود.
    expect((await say('کو'))?.text).toContain('روشن‌تر');

    expect((await say('کولرِ اتاق ۲۰۳ کار نمی‌کند'))?.text).toContain('قدم 2 از 3');
    expect((await say('⏭ رد کردن'))?.text).toContain('فوری');

    // اولویتِ خارج از کیبورد رد می‌شود.
    expect((await say('خیلی'))?.text).toContain('گزینه‌های روی کیبورد');
    const done = await say('اضطراری');

    expect(done?.text).toContain('MR-00001');
    expect(requests).toEqual([
      {
        title: 'کولرِ اتاق ۲۰۳ کار نمی‌کند',
        location: '',
        priority: 'emergency',
        category: 'other',
      },
    ]);
    // پس از ثبت، گفتگو بسته است.
    expect(await say('سلام')).toBeNull();
  });

  it('مرخصی: تاریخِ شمسی، ردِ «تا» پیش از «از»، ثبت با ISO', async () => {
    await startFlow(BotFlow.LEAVE);
    expect((await say('دیروز'))?.text).toContain('۱۴۰۴/۰۵/۱۲');
    await say('۱۴۰۴/۰۵/۱۲');
    expect((await say('۱۴۰۴/۰۵/۱۰'))?.text).toContain('پیش از شروع');
    await say('۱۴۰۴/۰۵/۱۴');
    await say('استحقاقی');
    const done = await say('سفرِ خانوادگی');

    expect(done?.text).toContain('LV-00001');
    expect(done?.text).toContain('3 روز');
    expect(leaves).toEqual([
      {
        personnelId: PERSON,
        type: 'annual',
        fromDate: '2025-08-03',
        toDate: '2025-08-05',
        reason: 'سفرِ خانوادگی',
      },
    ]);
  });

  it('شکستِ ثبت دلیلِ واقعی را به کاربر می‌گوید و گفتگو را می‌بندد', async () => {
    leaveError = { response: { message: 'برای این بازه مرخصیِ ثبت‌شده دارید' } };
    await startFlow(BotFlow.LEAVE);
    await say('۱۴۰۴/۰۵/۱۲');
    await say('۱۴۰۴/۰۵/۱۲');
    await say('استعلاجی');
    const done = await say('⏭ رد کردن');
    expect(done?.text).toContain('ثبت نشد');
    expect(done?.text).toContain('مرخصیِ ثبت‌شده دارید');
    expect(await say('سلام')).toBeNull();
  });

  it('پاسخ به نامه: متن به همان نامه و از طرفِ همان پرسنل می‌رود', async () => {
    await startFlow(BotFlow.LETTER_REPLY, 'letter-42');
    expect((await say('x'))?.text).toContain('خالی');
    const done = await say('بله، فردا انجام می‌شود.');
    expect(done?.text).toContain('LT-00002');
    expect(replies).toEqual([
      { letterId: 'letter-42', personnelId: PERSON, body: 'بله، فردا انجام می‌شود.' },
    ]);
  });

  it('«لغو» وسطِ کار گفتگو را می‌بندد بی‌آنکه چیزی ثبت شود', async () => {
    await startFlow(BotFlow.FAULT);
    await say('آبِ سینکِ آشپزخانه چکه می‌کند');
    expect((await say('✖️ لغو'))?.text).toContain('لغو شد');
    expect(requests).toEqual([]);
    expect(await say('سلام')).toBeNull();
  });

  it('شروعِ کارِ تازه جایگزینِ کارِ نیمه‌کاره‌ی قبلی می‌شود', async () => {
    await startFlow(BotFlow.FAULT);
    await say('لامپِ راهرو سوخته');
    await startFlow(BotFlow.LETTER_REPLY, 'letter-1');
    expect(await ds.getRepository(BotFlowSessionEntity).count()).toBe(1);
    await say('دریافت شد');
    expect(requests).toEqual([]);
    expect(replies).toHaveLength(1);
  });
});
