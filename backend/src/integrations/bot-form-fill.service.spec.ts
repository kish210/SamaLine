jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));
// @nestjs/jwt فایلِ ESM است و Jest آن را بار نمی‌کند؛ سرویس فقط نوعش را برای
// تزریق لازم دارد و تست استابِ خودش را می‌دهد.
jest.mock('@nestjs/jwt', () => ({ JwtService: class {} }));

import type { DataSource } from 'typeorm';
import { createTestDataSource } from '../testing/test-database';
import { BotFormSessionEntity } from '../database/entities/bot-form-session.entity';
import { FormEntity, FormStatus } from '../database/entities/form.entity';
import { FormVersionEntity } from '../database/entities/form-version.entity';
import {
  PublicationEntity,
  PublicationType,
} from '../database/entities/publication.entity';
import { OrganizationEntity } from '../database/entities/organization.entity';
import { WorkspaceEntity } from '../database/entities/workspace.entity';
import { jalaliToIso } from '../common/jalali';
import {
  BotFormFillService,
  isBotFillable,
  type BotQuestion,
} from './bot-form-fill.service';

const CHAT = 'chat-1';
const PLATFORM = 'bale';
const MOBILE = '09120000001';

/** دکمه‌های ثابتِ گفتگو؛ همان متنی که سرویس می‌فرستد. */
const BTN_CANCEL = '✖️ لغوِ فرم';
const BTN_SKIP = '⏭ رد کردن';

/** متنِ همه‌ی دکمه‌های کیبوردِ پاسخ، یکجا. */
const buttonsOf = (reply: { keyboard?: Record<string, unknown> } | null) => {
  const rows = (reply?.keyboard?.keyboard ?? []) as Array<
    Array<{ text: string }>
  >;
  return rows.flat().map((b) => b.text);
};

describe('isBotFillable', () => {
  const q = (type: string): BotQuestion => ({ id: type, type, title: type });

  it('فرمِ بی‌سوال در گفتگو پر نمی‌شود', () => {
    expect(isBotFillable([])).toBe(false);
  });

  it('نوع‌های متنی/دکمه‌ای در گفتگو پر می‌شوند', () => {
    expect(
      isBotFillable([
        q('short_text'),
        q('number'),
        q('multiple_choice'),
        q('rating'),
        q('date'),
        q('boolean'),
        q('static_text'),
      ]),
    ).toBe(true);
  });

  it('یک نوعِ نشدنی کلِ فرم را به مینی‌اپ می‌فرستد', () => {
    // آپلودِ فایل با پیامِ متنی ممکن نیست.
    expect(isBotFillable([q('short_text'), q('file_upload')])).toBe(false);
    expect(isBotFillable([q('signature')])).toBe(false);
    expect(isBotFillable([q('matrix')])).toBe(false);
  });

  it('منطقِ شرطی فرم را به مینی‌اپ می‌فرستد', () => {
    const qs = [q('short_text')];
    // گفتگو موتورِ منطق را اجرا نمی‌کند، پس سوالِ نامربوط پرسیده می‌شد.
    expect(isBotFillable(qs, { skip: [{ from: 'a' }] })).toBe(false);
    expect(isBotFillable(qs, { display: [{ target: 'a' }] })).toBe(false);
    // فهرستِ خالی یا کلیدِ نبوده مانعی نیست.
    expect(isBotFillable(qs, { skip: [], display: [] })).toBe(true);
    expect(isBotFillable(qs, {})).toBe(true);
    expect(isBotFillable(qs, null)).toBe(true);
  });
});

describe('BotFormFillService', () => {
  let ds: DataSource;
  let service: BotFormFillService;
  let submitted: Array<{
    token: string;
    body: { answers: Record<string, unknown>; meta?: Record<string, unknown> };
    accessToken?: string;
  }>;
  /** خطایی که ثبتِ بعدی باید پرتاب کند (برای آزمونِ مسیرِ شکست). */
  let submitError: unknown = null;
  let formId: string;
  let publicationId: string;
  let publicationToken: string;

  /** فرمِ واقعی با همین سوال‌ها، و یک انتشارِ لینکِ فعال. */
  const seedForm = async (questions: BotQuestion[], slug?: string | null) => {
    const org = await ds.getRepository(OrganizationEntity).save({
      name: 'هتل',
    });
    const ws = await ds
      .getRepository(WorkspaceEntity)
      .save({ organizationId: org.id, name: 'فضا' });
    const form = await ds.getRepository(FormEntity).save({
      workspaceId: ws.id,
      title: 'فرمِ تست',
      slug: `f-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      status: FormStatus.ACTIVE,
    });
    await ds.getRepository(FormVersionEntity).save({
      formId: form.id,
      version: 1,
      structure: { pages: [{ questions }] },
    });
    const pub = await ds.getRepository(PublicationEntity).save({
      formId: form.id,
      type: PublicationType.LINK,
      token: `tok-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      slug: slug ?? null,
      isActive: true,
    });
    formId = form.id;
    publicationId = pub.id;
    publicationToken = pub.slug ?? pub.token;
    return form.id;
  };

  /** شروعِ گفتگو روی فرمِ ساخته‌شده. */
  const start = () =>
    service.start({
      chatId: CHAT,
      platform: PLATFORM,
      formId,
      publicationId,
      respondentKey: MOBILE,
      formTitle: 'فرمِ تست',
    });

  const say = (text: string) => service.handleMessage(CHAT, PLATFORM, text);

  beforeEach(async () => {
    ds = await createTestDataSource();
    submitted = [];
    submitError = null;
    service = new BotFormFillService(
      ds.getRepository(BotFormSessionEntity),
      ds.getRepository(FormVersionEntity),
      {
        submitByToken: async (
          token: string,
          body: {
            answers: Record<string, unknown>;
            meta?: Record<string, unknown>;
          },
          accessToken?: string,
        ) => {
          if (submitError) throw submitError;
          submitted.push({ token, body, accessToken });
          return { id: 'resp-1' };
        },
      } as never,
      // سرویس فقط sign را صدا می‌زند؛ استابِ ساده @nestjs/jwt (ESM) را وارد نمی‌کند.
      {
        sign: (payload: Record<string, unknown>) =>
          `tok.${Buffer.from(JSON.stringify(payload)).toString('base64url')}`,
      } as never,
    );
  });

  afterEach(async () => {
    await ds.destroy();
  });

  it('پیامِ چتِ بی‌گفتگو را رها می‌کند تا به منو برود', async () => {
    expect(await say('سلام')).toBeNull();
  });

  it('شروع، گفتگو را می‌سازد و سوالِ اول را با شمارنده می‌پرسد', async () => {
    await seedForm([
      { id: 'q1', type: 'short_text', title: 'نامِ شما', required: true },
      { id: 'q2', type: 'long_text', title: 'توضیح' },
    ]);
    const reply = await start();

    expect(reply.text).toContain('فرمِ تست');
    expect(reply.text).toContain('نامِ شما');
    expect(reply.text).toContain('سوال 1 از 2');
    // سوالِ اجباری دکمه‌ی «رد کردن» ندارد، ولی لغو همیشه هست.
    expect(buttonsOf(reply)).toContain(BTN_CANCEL);
    expect(buttonsOf(reply)).not.toContain(BTN_SKIP);

    const session = await service.findSession(CHAT, PLATFORM);
    expect(session?.questionIndex).toBe(0);
    expect(session?.formId).toBe(formId);
    expect(session?.respondentKey).toBe(MOBILE);
  });

  it('فرمِ بی‌سوال گفتگو نمی‌سازد', async () => {
    await seedForm([]);
    const reply = await start();
    expect(reply.text).toContain('سوالی ندارد');
    expect(await service.findSession(CHAT, PLATFORM)).toBeNull();
  });

  it('شروعِ فرمِ تازه، گفتگوی نیمه‌کاره‌ی قبلی را جایگزین می‌کند', async () => {
    await seedForm([{ id: 'a1', type: 'short_text', title: 'اولی' }]);
    await start();
    const firstForm = formId;

    await seedForm([{ id: 'b1', type: 'short_text', title: 'دومی' }]);
    const reply = await start();
    expect(reply.text).toContain('دومی');

    // فقط یک گفتگو برای این چت می‌ماند، و روی فرمِ تازه است.
    expect(await ds.getRepository(BotFormSessionEntity).count()).toBe(1);
    const session = await service.findSession(CHAT, PLATFORM);
    expect(session?.formId).toBe(formId);
    expect(session?.formId).not.toBe(firstForm);
  });

  it('«متنِ ثابت» پاسخ نمی‌خواهد؛ نشان داده و رد می‌شود', async () => {
    await seedForm([
      { id: 'n1', type: 'static_text', title: 'لطفاً دقیق پر کنید.' },
      { id: 'q1', type: 'short_text', title: 'شرحِ خرابی' },
    ]);
    const reply = await start();
    expect(reply.text).toContain('لطفاً دقیق پر کنید.');
    expect(reply.text).toContain('شرحِ خرابی');
    // سوالِ جاری همان سوالِ واقعی است، نه متنِ ثابت.
    expect((await service.findSession(CHAT, PLATFORM))?.questionIndex).toBe(1);
  });

  it('لغو، گفتگو را پاک می‌کند و کیبورد را برمی‌دارد', async () => {
    await seedForm([{ id: 'q1', type: 'short_text', title: 'چیزی' }]);
    await start();
    const reply = await say(BTN_CANCEL);
    expect(reply?.text).toContain('لغو شد');
    expect(reply?.keyboard).toEqual({ remove_keyboard: true });
    expect(await service.findSession(CHAT, PLATFORM)).toBeNull();
  });

  it('‎/cancel هم لغو می‌کند', async () => {
    await seedForm([{ id: 'q1', type: 'short_text', title: 'چیزی' }]);
    await start();
    await say('/cancel');
    expect(await service.findSession(CHAT, PLATFORM)).toBeNull();
  });

  describe('اعتبارسنجیِ پاسخ', () => {
    /** گفتگویی با یک سوالِ دلخواه و یک سوالِ دوم، تا پیشرفت دیده شود. */
    const withQuestion = async (q: BotQuestion) => {
      await seedForm([q, { id: 'tail', type: 'short_text', title: 'پایان' }]);
      await start();
    };

    it('پاسخِ نامعتبر همان سوال را دوباره می‌پرسد و جلو نمی‌رود', async () => {
      await withQuestion({ id: 'q1', type: 'email', title: 'ایمیل' });
      const reply = await say('نه-ایمیل');
      expect(reply?.text).toContain('ایمیل معتبر نیست');
      expect(reply?.text).toContain('ایمیل');
      expect((await service.findSession(CHAT, PLATFORM))?.questionIndex).toBe(0);
    });

    it('عددِ خارج از بازه رد می‌شود، درونِ بازه پذیرفته', async () => {
      await withQuestion({
        id: 'q1',
        type: 'rating',
        title: 'امتیاز',
        meta: { min: 1, max: 5 },
      });
      expect((await say('9'))?.text).toContain('بین 1 تا 5');
      expect((await service.findSession(CHAT, PLATFORM))?.questionIndex).toBe(0);

      await say('4');
      const session = await service.findSession(CHAT, PLATFORM);
      expect(session?.questionIndex).toBe(1);
      expect(session?.answers.q1).toBe(4);
    });

    it('ارقامِ فارسی را عدد می‌فهمد', async () => {
      await withQuestion({ id: 'q1', type: 'number', title: 'تعداد' });
      await say('۱۲۳');
      expect((await service.findSession(CHAT, PLATFORM))?.answers.q1).toBe(123);
    });

    it('nps بازه‌ی ثابتِ ۰ تا ۱۰ دارد', async () => {
      await withQuestion({ id: 'q1', type: 'nps', title: 'توصیه' });
      expect((await say('11'))?.text).toContain('بین 0 تا 10');
      await say('0');
      expect((await service.findSession(CHAT, PLATFORM))?.answers.q1).toBe(0);
    });

    it('بله/خیر به yes/no تبدیل می‌شود', async () => {
      await withQuestion({ id: 'q1', type: 'boolean', title: 'تأیید؟' });
      expect((await say('شاید'))?.text).toContain('«بله» یا «خیر»');
      await say('بله');
      expect((await service.findSession(CHAT, PLATFORM))?.answers.q1).toBe(
        'yes',
      );
    });

    it('گزینه باید از فهرست باشد', async () => {
      await withQuestion({
        id: 'q1',
        type: 'multiple_choice',
        title: 'بخش',
        options: ['برق', 'لوله‌کشی'],
      });
      expect((await say('باغبانی'))?.text).toContain('کیبورد');
      await say('برق');
      expect((await service.findSession(CHAT, PLATFORM))?.answers.q1).toBe(
        'برق',
      );
    });

    it('چندگزینه‌ایِ چندانتخابی با ویرگول جدا می‌شود', async () => {
      await withQuestion({
        id: 'q1',
        type: 'multiple_choice',
        title: 'خرابی‌ها',
        options: ['برق', 'آب', 'کولر'],
        meta: { multiple: true },
      });
      expect((await say('برق، نور'))?.text).toContain('«نور» در فهرست نیست');
      await say('برق، کولر');
      expect((await service.findSession(CHAT, PLATFORM))?.answers.q1).toEqual([
        'برق',
        'کولر',
      ]);
    });

    it('تاریخِ شمسی به میلادی ذخیره می‌شود', async () => {
      await withQuestion({ id: 'q1', type: 'date', title: 'تاریخ' });
      expect((await say('دیروز'))?.text).toContain('۱۴۰۴/۰۵/۱۲');
      await say('۱۴۰۴/۰۵/۱۲');
      expect((await service.findSession(CHAT, PLATFORM))?.answers.q1).toBe(
        jalaliToIso(1404, 5, 12),
      );
    });

    it('تاریخِ میلادی هم پذیرفته می‌شود', async () => {
      await withQuestion({ id: 'q1', type: 'date', title: 'تاریخ' });
      await say('2026-03-21');
      expect((await service.findSession(CHAT, PLATFORM))?.answers.q1).toBe(
        '2026-03-21',
      );
    });

    it('موبایل فقط رقم‌ها را نگه می‌دارد و کوتاه را رد می‌کند', async () => {
      await withQuestion({ id: 'q1', type: 'mobile', title: 'موبایل' });
      expect((await say('0912'))?.text).toContain('معتبر نیست');
      await say('0912 000 0001');
      expect((await service.findSession(CHAT, PLATFORM))?.answers.q1).toBe(
        '09120000001',
      );
    });

    it('نشانی باید با http شروع شود', async () => {
      await withQuestion({ id: 'q1', type: 'url', title: 'لینک' });
      expect((await say('example.com'))?.text).toContain('http');
      await say('https://example.com/a');
      expect((await service.findSession(CHAT, PLATFORM))?.answers.q1).toBe(
        'https://example.com/a',
      );
    });
  });

  describe('رد کردنِ سوال', () => {
    it('سوالِ غیراجباری رد می‌شود و بی‌پاسخ می‌ماند', async () => {
      await seedForm([
        { id: 'q1', type: 'short_text', title: 'اختیاری' },
        { id: 'q2', type: 'short_text', title: 'بعدی' },
      ]);
      const first = await start();
      expect(buttonsOf(first)).toContain(BTN_SKIP);

      await say(BTN_SKIP);
      const session = await service.findSession(CHAT, PLATFORM);
      expect(session?.questionIndex).toBe(1);
      expect(session?.answers).not.toHaveProperty('q1');
    });

    it('سوالِ اجباری رد نمی‌شود', async () => {
      await seedForm([
        { id: 'q1', type: 'short_text', title: 'اجباری', required: true },
        { id: 'q2', type: 'short_text', title: 'بعدی' },
      ]);
      await start();
      const reply = await say(BTN_SKIP);
      expect(reply?.text).toContain('اجباری است');
      expect((await service.findSession(CHAT, PLATFORM))?.questionIndex).toBe(0);
    });
  });

  describe('ثبتِ نهایی', () => {
    it('با پاسخِ آخر، فرم ثبت و گفتگو بسته می‌شود', async () => {
      await seedForm([
        { id: 'q1', type: 'short_text', title: 'شرح' },
        { id: 'q2', type: 'rating', title: 'فوریت', meta: { min: 1, max: 5 } },
      ]);
      await start();
      await say('کولر کار نمی‌کند');
      const done = await say('5');

      expect(done?.text).toContain('ثبت شد');
      expect(done?.keyboard).toEqual({ remove_keyboard: true });
      // گفتگو بسته می‌شود تا پیامِ بعدی به منو برود.
      expect(await service.findSession(CHAT, PLATFORM)).toBeNull();
      expect(await say('سلام')).toBeNull();

      expect(submitted).toHaveLength(1);
      expect(submitted[0].token).toBe(publicationToken);
      expect(submitted[0].body.answers).toEqual({
        q1: 'کولر کار نمی‌کند',
        q2: 5,
      });
      expect(submitted[0].body.meta).toEqual({ source: 'bot' });
    });

    it('ثبت با هویتِ همان پرسنل و حالتِ bot انجام می‌شود', async () => {
      await seedForm([{ id: 'q1', type: 'short_text', title: 'شرح' }]);
      await start();
      await say('نشتیِ لوله');

      const payload = JSON.parse(
        Buffer.from(
          (submitted[0].accessToken ?? '').split('.')[1],
          'base64url',
        ).toString(),
      );
      // پاسخ باید به نامِ خودِ پرسنل بنشیند، نه مهمانِ ناشناس.
      expect(payload).toMatchObject({
        publicationId,
        respondentKey: MOBILE,
        mode: 'bot',
      });
    });

    it('اگر انتشار slug داشته باشد، ثبت از مسیرِ slug است', async () => {
      await seedForm([{ id: 'q1', type: 'short_text', title: 'شرح' }], 'nazar');
      await start();
      await say('خوب بود');
      expect(submitted[0].token).toBe('nazar');
    });

    it('متنِ ثابتِ پایانِ فرم هم نشان داده می‌شود', async () => {
      await seedForm([
        { id: 'q1', type: 'short_text', title: 'شرح' },
        { id: 'n1', type: 'static_text', title: 'ممنون از همکاری.' },
      ]);
      await start();
      const done = await say('چیزی');
      expect(done?.text).toContain('ممنون از همکاری.');
      expect(done?.text).toContain('ثبت شد');
      expect(submitted).toHaveLength(1);
    });

    it('شکستِ ثبت گزارش می‌شود و گفتگو را باز نمی‌گذارد', async () => {
      await seedForm([{ id: 'q1', type: 'short_text', title: 'شرح' }]);
      await start();
      // شکلِ خطای NestJS: پیامِ فارسی داخلِ response می‌نشیند.
      submitError = Object.assign(new Error('سقفِ پاسخ پر است'), {
        response: { message: 'سقفِ پاسخ پر است' },
      });
      const done = await say('چیزی');

      expect(done?.text).toContain('ناموفق');
      expect(done?.text).toContain('سقفِ پاسخ پر است');
      // گفتگوی نیمه‌کاره نمی‌ماند؛ وگرنه کاربر در حلقه گیر می‌کرد.
      expect(await service.findSession(CHAT, PLATFORM)).toBeNull();
    });
  });

  it('حذفِ نسخه‌ی فرم گفتگو را بی‌خطر می‌بندد', async () => {
    await seedForm([
      { id: 'q1', type: 'short_text', title: 'اول' },
      { id: 'q2', type: 'short_text', title: 'دوم' },
    ]);
    await start();
    // نسخه‌ی فرم ناپدید می‌شود (حذفِ فرم، بازگردانیِ نسخه) و سوالِ جاری نمی‌ماند.
    await ds.getRepository(FormVersionEntity).delete({ formId });

    const reply = await say('چیزی');
    expect(reply?.text).toContain('در دسترس نیست');
    expect(await service.findSession(CHAT, PLATFORM)).toBeNull();
  });

  it('گفتگوی هر پیام‌رسان جداست', async () => {
    await seedForm([{ id: 'q1', type: 'short_text', title: 'شرح' }]);
    await start();
    // همان chatId روی تلگرام گفتگوی باز ندارد.
    expect(await service.handleMessage(CHAT, 'telegram', 'چیزی')).toBeNull();
    expect(await service.findSession(CHAT, PLATFORM)).toBeTruthy();
  });

  it('structureOf آخرین نسخه را می‌دهد', async () => {
    await seedForm([{ id: 'old', type: 'short_text', title: 'قدیمی' }]);
    await ds.getRepository(FormVersionEntity).save({
      formId,
      version: 2,
      structure: {
        pages: [{ questions: [{ id: 'new', type: 'number', title: 'تازه' }] }],
        logic: { skip: [{ from: 'new' }] },
      },
    });

    const { questions, logic } = await service.structureOf(formId);
    expect(questions).toHaveLength(1);
    expect(questions[0].id).toBe('new');
    expect(logic).toEqual({ skip: [{ from: 'new' }] });
  });

  it('سوال‌های همه‌ی صفحه‌ها پشتِ‌سرهم پرسیده می‌شوند', async () => {
    const org = await ds.getRepository(OrganizationEntity).save({
      name: 'هتل',
    });
    const ws = await ds
      .getRepository(WorkspaceEntity)
      .save({ organizationId: org.id, name: 'فضا' });
    const form = await ds.getRepository(FormEntity).save({
      workspaceId: ws.id,
      title: 'چندصفحه',
      slug: `multi-${Date.now()}`,
      status: FormStatus.ACTIVE,
    });
    await ds.getRepository(FormVersionEntity).save({
      formId: form.id,
      version: 1,
      structure: {
        pages: [
          { questions: [{ id: 'p1q1', type: 'short_text', title: 'ص۱' }] },
          { questions: [{ id: 'p2q1', type: 'short_text', title: 'ص۲' }] },
        ],
      },
    });
    const { questions } = await service.structureOf(form.id);
    expect(questions.map((q) => q.id)).toEqual(['p1q1', 'p2q1']);
  });
});
