jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));
// @nestjs/jwt فایلِ ESM است و Jest آن را بار نمی‌کند؛ سرویس فقط نوعش را برای
// تزریق لازم دارد و تست استابِ خودش را می‌دهد.
jest.mock('@nestjs/jwt', () => ({ JwtService: class {} }));

import type { DataSource } from 'typeorm';
import { PersonnelEntity } from '../database/entities/personnel.entity';
import { PersonnelBotLinkEntity } from '../database/entities/personnel-bot-link.entity';
import type { TelegramIntegrationEntity } from '../database/entities/telegram-integration.entity';
import { createTestDataSource } from '../testing/test-database';
import { HrService } from '../hr/hr.service';
import { StaffBotService, looksLikeMobile } from './staff-bot.service';
import { FormEntity, FormStatus } from '../database/entities/form.entity';
import { FormVersionEntity } from '../database/entities/form-version.entity';
import {
  PublicationEntity,
  PublicationType,
} from '../database/entities/publication.entity';
import {
  ResponseEntity,
  ResponseStatus,
} from '../database/entities/response.entity';
import { OrganizationEntity } from '../database/entities/organization.entity';
import { WorkspaceEntity } from '../database/entities/workspace.entity';

const ORG = 'org-1';
const BOT = {
  workspaceId: 'ws-1',
  platform: 'bale',
} as TelegramIntegrationEntity;

describe('StaffBotService', () => {
  let ds: DataSource;
  let hr: HrService;
  let service: StaffBotService;
  /** کارها و شیفت‌هایی که استابِ CMMS/شیفت برمی‌گرداند. */
  let tasks: Array<Record<string, unknown>>;
  let shiftRows: Array<Record<string, unknown>>;
  let statusCalls: Array<{ id: string; to: string }>;
  let statusError: unknown;
  let punchError: unknown;
  /** صندوقِ نامه‌ای که استابِ LetterService برمی‌گرداند. */
  let letterRows: Array<Record<string, unknown>>;
  let markReadCalls: string[];
  let inboxSearches: Array<string | undefined>;
  /** پاسخی که BotFlowService برای پیامِ «در حینِ کار» می‌دهد؛ null یعنی کاری باز نیست. */
  let flowReply: unknown;
  let flowStarts: Array<Record<string, unknown>>;

  beforeEach(async () => {
    tasks = [];
    shiftRows = [];
    statusCalls = [];
    statusError = null;
    punchError = null;
    letterRows = [];
    markReadCalls = [];
    inboxSearches = [];
    flowReply = null;
    flowStarts = [];
    ds = await createTestDataSource();
    hr = new HrService(
      ds.getRepository(PersonnelEntity),
      ds.getRepository(PersonnelBotLinkEntity),
    );
    // فضای کاری همیشه به سازمانِ تست وصل است.
    const workspaces = {
      findOne: async () => ({ id: 'ws-1', organizationId: ORG }),
    } as never;
    const announcements = {
      list: async () => [
        {
          id: 'a1',
          departmentId: null,
          title: 'جلسهٔ عمومی',
          body: 'فردا ۹',
          createdAt: new Date('2026-03-21T08:00:00Z'),
        },
        {
          id: 'a2',
          departmentId: 'dept-other',
          title: 'فقط بخشِ دیگر',
          body: 'نامربوط',
          createdAt: new Date('2026-03-20T08:00:00Z'),
        },
      ],
    } as never;
    service = new StaffBotService(
      workspaces,
      hr,
      announcements,
      ds.getRepository(ResponseEntity),
      ds.getRepository(FormEntity),
      ds.getRepository(PublicationEntity),
      // سرویس فقط sign را صدا می‌زند؛ استابِ ساده کافی است و @nestjs/jwt را
      // (که ESM است و در Jest بار نمی‌شود) وارد نمی‌کند.
      {
        sign: (payload: Record<string, unknown>) =>
          `tok.${Buffer.from(JSON.stringify(payload)).toString('base64url')}`,
      } as never,
      /*
       * سرویسِ پر کردنِ فرم در گفتگو: این تست‌ها مسیرِ منو را می‌سنجند، پس
       * «گفتگوی باز» ندارد (null) و ساختارِ فرم‌ها خالی است تا همه با مینی‌اپ
       * فهرست شوند.
       */
      {
        handleMessage: async () => null,
        structureOf: async () => ({ questions: [], logic: null }),
        start: async () => ({ text: 'شروع' }),
      } as never,
      /*
       * CMMS و برنامهٔ کار با استابِ قابل‌تنظیم می‌آیند.
       *
       * هر تست مقدارِ `tasks` و `shiftRows` را عوض می‌کند، پس مسیرِ ربات
       * بدونِ ساختنِ کلِ دامنهٔ فنی سنجیده می‌شود، ولی تماس‌ها ثبت می‌شوند
       * تا بشود دید ربات واقعاً چه خواسته است.
       */
      {
        workOrdersOfTechnician: async () => tasks,
        changeWorkOrderStatus: async (
          _org: string,
          id: string,
          to: string,
        ) => {
          statusCalls.push({ id, to });
          if (statusError) throw statusError;
          return {};
        },
      } as never,
      {
        myShifts: async () => shiftRows,
        botPunch: async (_org: string, _p: string, kind: 'in' | 'out') => {
          if (punchError) throw punchError;
          return kind === 'in'
            ? { checkIn: '07:05', status: 'present', minutesWorked: 0 }
            : { checkOut: '15:00', status: 'present', minutesWorked: 480 };
        },
      } as never,
      // نامه‌ها: صندوقِ قابل‌تنظیم، و ثبتِ جست‌وجو/خواندن برای سنجش.
      {
        inbox: async (
          _org: string,
          _personnelId: string,
          query: { search?: string } = {},
        ) => {
          inboxSearches.push(query.search);
          const rows = query.search
            ? letterRows.filter((l) => l.number === query.search)
            : letterRows;
          return { rows, total: rows.length };
        },
        markRead: async (_org: string, id: string) => {
          markReadCalls.push(id);
        },
      } as never,
      // کارهای چندمرحله‌ای: پاسخِ قابل‌تنظیم و ثبتِ شروع‌ها.
      {
        handleMessage: async () => flowReply,
        start: async (input: Record<string, unknown>) => {
          flowStarts.push(input);
          return { text: `شروعِ ${String(input.flow)}` };
        },
        cancel: async () => undefined,
      } as never,
    );
  });

  it('تشخیصِ موبایل: رقم‌های ۱۰ تا ۱۳، نه فرمان و نه کد', () => {
    expect(looksLikeMobile('09123456789')).toBe(true);
    expect(looksLikeMobile('0912-345-6789')).toBe(true);
    expect(looksLikeMobile('/me')).toBe(false);
    expect(looksLikeMobile('ABC234')).toBe(false); // کدِ اتصالِ مدیر
  });

  it('با موبایلِ ثبت‌شده، گفتگو را به پرونده وصل می‌کند', async () => {
    await hr.create(ORG, { fullName: 'زهرا محمدی', mobile: '09120000001' });
    const reply = await service.tryHandle(BOT, 'chat-7', '0912 000 0001');
    // اتصالِ موفق متن + کیبوردِ پرسنلی برمی‌گرداند.
    expect(replyText(reply)).toContain('زهرا محمدی');
    expect(typeof reply === 'object' && reply?.keyboard).toBeTruthy();

    const linked = await hr.findByChat('chat-7', 'bale');
    expect(linked?.fullName).toBe('زهرا محمدی');
    // اتصال سطرِ جدولِ اتصال است، نه ستونِ منسوخِ روی پرونده.
    const links = await hr.linksOf(ORG, linked?.id ?? '');
    expect(links.map((l) => l.platform)).toEqual(['bale']);
    expect(links[0].chatId).toBe('chat-7');
  });

  it('موبایلِ ناشناخته وصل نمی‌شود', async () => {
    const reply = await service.tryHandle(BOT, 'chat-7', '09129999999');
    expect(reply).toContain('پیدا نشد');
    expect(await hr.findByChat('chat-7', 'bale')).toBeNull();
  });

  it('پرسنلِ غیرفعال وصل نمی‌شود', async () => {
    await hr.create(ORG, {
      fullName: 'اخراجی',
      mobile: '09120000002',
      isActive: false,
    });
    const reply = await service.tryHandle(BOT, 'chat-8', '09120000002');
    expect(reply).toContain('پیدا نشد');
  });

  it('/me پرونده‌ی متصل را نشان می‌دهد، وگرنه راهنمایی می‌کند', async () => {
    await hr.create(ORG, {
      fullName: 'علی رضایی',
      mobile: '09120000003',
      position: 'سرایدار',
    });
    expect(await service.tryHandle(BOT, 'chat-9', '/me')).toContain(
      'وصل نشده',
    );
    await service.tryHandle(BOT, 'chat-9', '09120000003');
    const status = await service.tryHandle(BOT, 'chat-9', '/me');
    expect(status).toContain('علی رضایی');
    expect(status).toContain('سرایدار');
  });

  it('/خروج اتصال را قطع می‌کند', async () => {
    await hr.create(ORG, { fullName: 'کارمند', mobile: '09120000004' });
    await service.tryHandle(BOT, 'chat-10', '09120000004');
    const reply = await service.tryHandle(BOT, 'chat-10', '/خروج');
    expect(reply).toContain('قطع شد');
    expect(await hr.findByChat('chat-10', 'bale')).toBeNull();
  });

  it('اتصالِ دوباره با موبایلِ دیگر، گفتگو را جابه‌جا می‌کند', async () => {
    await hr.create(ORG, { fullName: 'اول', mobile: '09120000005' });
    await hr.create(ORG, { fullName: 'دوم', mobile: '09120000006' });
    await service.tryHandle(BOT, 'chat-11', '09120000005');
    await service.tryHandle(BOT, 'chat-11', '09120000006');
    const linked = await hr.findByChat('chat-11', 'bale');
    expect(linked?.fullName).toBe('دوم');
    // اولی دیگر به این گفتگو وصل نیست.
    const first = (await hr.list(ORG)).find((p) => p.fullName === 'اول');
    expect(first?.botChatId).toBeNull();
  });

  it('پیامِ غیرِپرسنلی را رها می‌کند تا رباتِ مدیریتی بگیرد', async () => {
    expect(await service.tryHandle(BOT, 'chat-12', '/report')).toBeNull();
    expect(await service.tryHandle(BOT, 'chat-12', 'ABC234')).toBeNull();
  });

  it('/اطلاعیه فقط اطلاعیهٔ عمومی و بخشِ خودِ پرسنل را نشان می‌دهد', async () => {
    await hr.create(ORG, { fullName: 'مریم', mobile: '09120000020' });
    await service.tryHandle(BOT, 'chat-20', '09120000020');
    const reply = await service.tryHandle(BOT, 'chat-20', '/اطلاعیه');
    expect(reply).toContain('جلسهٔ عمومی');
    // اطلاعیهٔ بخشِ دیگر نباید دیده شود (پرسنل بخشی ندارد).
    expect(reply).not.toContain('فقط بخشِ دیگر');
  });

  it('/اطلاعیه برای کاربرِ وصل‌نشده راهنمایی می‌کند', async () => {
    const reply = await service.tryHandle(BOT, 'chat-21', '/اطلاعیه');
    expect(reply).toContain('وصل نشده');
  });

  describe('/درخواست‌ها', () => {
    let n = 0;
    /** سازمانِ واقعی + فرم + یک درخواست با کلیدِ موبایل و وضعیتِ دلخواه. */
    const seedRequest = async (opts: {
      orgId: string;
      mobile: string;
      title: string;
      review?: { status: string; note?: string };
    }) => {
      n += 1;
      const ws = await ds
        .getRepository(WorkspaceEntity)
        .save({ organizationId: opts.orgId, name: `فضا ${n}` });
      const form = await ds.getRepository(FormEntity).save({
        workspaceId: ws.id,
        title: opts.title,
        slug: `req-${n}-${Date.now()}`,
        status: FormStatus.ACTIVE,
        settings: { requiresApproval: true },
      });
      const version = await ds
        .getRepository(FormVersionEntity)
        .save({ formId: form.id, version: 1, structure: { pages: [] } });
      const pub = await ds.getRepository(PublicationEntity).save({
        formId: form.id,
        type: PublicationType.LINK,
        token: `rt-${n}-${Date.now()}`,
        isActive: true,
      });
      await ds.getRepository(ResponseEntity).save({
        formVersionId: version.id,
        publicationId: pub.id,
        respondentKey: opts.mobile,
        status: ResponseStatus.COMPLETED,
        startedAt: new Date(),
        submittedAt: new Date(),
        answers: {},
        scores: {},
        meta: opts.review ? { review: opts.review } : {},
      });
    };

    const linkedStaff = async () => {
      const org = await ds
        .getRepository(OrganizationEntity)
        .save({ name: 'هتل' });
      await hr.create(org.id, { fullName: 'سمیرا', mobile: '09120000030' });
      // رباتِ تست سازمانِ ثابتِ ORG را برمی‌گرداند؛ اتصال را مستقیم با سازمانِ واقعی می‌سازیم.
      await hr.linkBotChat(org.id, '09120000030', 'chat-30', 'bale', 'ws-1');
      return org.id;
    };

    it('درخواست‌های خودِ پرسنل را با وضعیتِ تأیید نشان می‌دهد', async () => {
      const orgId = await linkedStaff();
      await seedRequest({
        orgId,
        mobile: '09120000030',
        title: 'مرخصیِ استحقاقی',
        review: { status: 'pending' },
      });
      await seedRequest({
        orgId,
        mobile: '09120000030',
        title: 'تغییرِ شیفت',
        review: { status: 'rejected', note: 'نیرو کم است' },
      });
      const reply = await service.tryHandle(BOT, 'chat-30', '/درخواست‌ها');
      expect(reply).toContain('مرخصیِ استحقاقی');
      expect(reply).toContain('در انتظار تأیید');
      expect(reply).toContain('تغییرِ شیفت');
      expect(reply).toContain('ردشده');
      expect(reply).toContain('نیرو کم است');
    });

    it('درخواستِ سازمانِ دیگر یا موبایلِ دیگر را نشان نمی‌دهد', async () => {
      const orgId = await linkedStaff();
      const other = await ds
        .getRepository(OrganizationEntity)
        .save({ name: 'هتلِ دیگر' });
      // همان موبایل در سازمانِ دیگر.
      await seedRequest({ orgId: other.id, mobile: '09120000030', title: 'غریبه' });
      // موبایلِ دیگر در همین سازمان.
      await seedRequest({ orgId, mobile: '09129999999', title: 'همکار' });
      const reply = await service.tryHandle(BOT, 'chat-30', '/requests');
      expect(reply).toContain('درخواستی از شما ثبت نشده');
    });

    it('برای کاربرِ وصل‌نشده راهنماییِ اتصال می‌دهد', async () => {
      const reply = await service.tryHandle(BOT, 'chat-99', '/درخواست‌ها');
      expect(reply).toContain('وصل نشده');
    });
  });

  describe('فرم‌ها (انتشار در ربات/مینی‌اپ)', () => {
    const OLD_URL = process.env.PUBLIC_URL;
    beforeEach(() => {
      process.env.PUBLIC_URL = 'https://x.test';
    });
    afterEach(() => {
      process.env.PUBLIC_URL = OLD_URL;
    });

    let m = 0;
    /** فرمِ فعال در سازمانِ داده‌شده، با/بی انتشار در ربات و لینکِ عمومی. */
    const seedForm = async (opts: {
      orgId: string;
      title: string;
      botPublish: boolean;
      withPublication?: boolean;
      departmentId?: string | null;
    }) => {
      m += 1;
      const ws = await ds
        .getRepository(WorkspaceEntity)
        .save({ organizationId: opts.orgId, name: `فرم‌فضا ${m}` });
      const form = await ds.getRepository(FormEntity).save({
        workspaceId: ws.id,
        title: opts.title,
        slug: `form-${m}-${Date.now()}`,
        status: FormStatus.ACTIVE,
        departmentId: opts.departmentId ?? null,
        settings: { botPublish: opts.botPublish },
      });
      if (opts.withPublication !== false) {
        await ds.getRepository(PublicationEntity).save({
          formId: form.id,
          type: PublicationType.LINK,
          token: `pub-${m}-${Date.now()}`,
          isActive: true,
        });
      }
      return form;
    };

    const linkedStaff = async () => {
      const org = await ds
        .getRepository(OrganizationEntity)
        .save({ name: 'هتل' });
      await hr.create(org.id, { fullName: 'رضا', mobile: '09120000040' });
      await hr.linkBotChat(org.id, '09120000040', 'chat-40', 'bale', 'ws-1');
      return org.id;
    };

    it('فقط فرمِ منتشرشده در ربات را با لینکِ مینی‌اپ نشان می‌دهد', async () => {
      const orgId = await linkedStaff();
      await seedForm({ orgId, title: 'گزارش روزانه', botPublish: true });
      await seedForm({ orgId, title: 'فرمِ خصوصی', botPublish: false });

      const reply = await service.tryHandle(BOT, 'chat-40', '📝 فرم‌ها');
      expect(replyText(reply)).toContain('گزارش روزانه');
      expect(replyText(reply)).not.toContain('فرمِ خصوصی');
      // فرمِ بی‌سوال در گفتگو پر نمی‌شود، پس لینکِ مینی‌اپ با توکنِ هویت می‌آید.
      expect(replyText(reply)).toContain('#rt=');
      expect(
        (reply as { keyboard?: Record<string, unknown> }).keyboard,
      ).toBeTruthy();
    });

    it('فرمِ منتشرشده ولی بدونِ لینکِ عمومی را کنار می‌گذارد', async () => {
      const orgId = await linkedStaff();
      await seedForm({
        orgId,
        title: 'بی‌لینک',
        botPublish: true,
        withPublication: false,
      });
      const reply = await service.tryHandle(BOT, 'chat-40', '/فرم‌ها');
      expect(replyText(reply)).toContain('منتشر نشده');
    });

    it('برای کاربرِ وصل‌نشده راهنماییِ اتصال می‌دهد', async () => {
      const reply = await service.tryHandle(BOT, 'chat-99', '/فرم‌ها');
      expect(replyText(reply)).toContain('وصل نشده');
    });
  });

  describe('کارهای من', () => {
    /** پرسنلِ وصل‌شده‌ی آماده، روی سازمانِ ثابتِ ربات. */
    const linked = async (chatId: string) => {
      await hr.create(ORG, { fullName: 'تکنسین', mobile: '09120000100' });
      await service.tryHandle(BOT, chatId, '09120000100');
    };

    const buttons = (reply: unknown): string[] => {
      if (!reply || typeof reply !== 'object' || !('keyboard' in reply)) {
        return [];
      }
      const rows = ((reply as { keyboard?: { keyboard?: unknown } }).keyboard
        ?.keyboard ?? []) as Array<Array<{ text: string }>>;
      return rows.flat().map((b) => b.text);
    };

    it('بی‌کار، پیامِ روشن می‌دهد', async () => {
      await linked('chat-50');
      const reply = await service.tryHandle(BOT, 'chat-50', '🔧 کارهای من');
      expect(replyText(reply)).toContain('کارِ بازی');
    });

    it('کارِ ارجاع‌شده دکمهٔ «شروع» می‌گیرد و در حالِ انجام دکمهٔ «تکمیل»', async () => {
      await linked('chat-51');
      tasks = [
        {
          id: 'wo-1',
          number: 'WO-00001',
          title: 'تعمیرِ کولر',
          status: 'assigned',
          priority: 'normal',
          dueDate: '',
        },
        {
          id: 'wo-2',
          number: 'WO-00002',
          title: 'نشتیِ لوله',
          status: 'in_progress',
          priority: 'emergency',
          dueDate: '2020-01-01',
        },
      ];

      const reply = await service.tryHandle(BOT, 'chat-51', '🔧 کارهای من');
      const text = replyText(reply);
      expect(text).toContain('WO-00001');
      expect(text).toContain('تعمیرِ کولر');
      expect(text).toContain('ارجاع‌شده به شما');
      // اضطراری و عقب‌افتاده باید دیده شوند، وگرنه اولویت گم می‌شود.
      expect(text).toContain('اضطراری');
      expect(text).toContain('عقب‌افتاده');

      expect(buttons(reply)).toContain('🚀 WO-00001');
      expect(buttons(reply)).toContain('✅ WO-00002');
    });

    it('«شروع» گذارِ درست را روی همان کار می‌زند', async () => {
      await linked('chat-52');
      tasks = [
        {
          id: 'wo-1',
          number: 'WO-00001',
          title: 'کار',
          status: 'assigned',
          priority: 'normal',
          dueDate: '',
        },
      ];
      const reply = await service.tryHandle(BOT, 'chat-52', '🚀 WO-00001');
      expect(statusCalls).toEqual([{ id: 'wo-1', to: 'in_progress' }]);
      expect(replyText(reply)).toContain('شروع شد');
    });

    it('«تکمیل» می‌گوید منتظرِ تأییدِ مدیر است', async () => {
      await linked('chat-53');
      tasks = [
        {
          id: 'wo-9',
          number: 'WO-00009',
          title: 'کار',
          status: 'in_progress',
          priority: 'normal',
          dueDate: '',
        },
      ];
      const reply = await service.tryHandle(BOT, 'chat-53', '✅ WO-00009');
      expect(statusCalls).toEqual([{ id: 'wo-9', to: 'completed' }]);
      // تکمیل خودش تأیید نیست؛ پیام نباید چیزِ دیگری ادعا کند.
      expect(replyText(reply)).toContain('تأییدِ مدیر');
    });

    it('کارِ سپرده‌نشده به این پرسنل پذیرفته نمی‌شود', async () => {
      await linked('chat-54');
      tasks = [];
      const reply = await service.tryHandle(BOT, 'chat-54', '🚀 WO-00404');
      expect(replyText(reply)).toContain('سپرده نشده');
      expect(statusCalls).toHaveLength(0);
    });

    it('خطای گذار به زبانِ کاربر برمی‌گردد', async () => {
      await linked('chat-55');
      tasks = [
        {
          id: 'wo-1',
          number: 'WO-00001',
          title: 'کار',
          status: 'assigned',
          priority: 'normal',
          dueDate: '',
        },
      ];
      statusError = { response: { message: 'گذار مجاز نیست' } };
      const reply = await service.tryHandle(BOT, 'chat-55', '🚀 WO-00001');
      expect(replyText(reply)).toContain('گذار مجاز نیست');
    });

    it('کاربرِ وصل‌نشده کارِ کسی را نمی‌بیند', async () => {
      const reply = await service.tryHandle(BOT, 'chat-56', '🔧 کارهای من');
      expect(replyText(reply)).toContain('وصل نشده');
    });
  });

  describe('شیفت و حضور', () => {
    const linked = async (chatId: string) => {
      await hr.create(ORG, { fullName: 'نگهبان', mobile: '09120000200' });
      await service.tryHandle(BOT, chatId, '09120000200');
    };

    it('بی‌برنامه، صریح می‌گوید شیفتی ثبت نشده', async () => {
      await linked('chat-60');
      const reply = await service.tryHandle(BOT, 'chat-60', '🗓 شیفتِ من');
      expect(replyText(reply)).toContain('ثبت نشده');
    });

    it('شیفت‌های هفته را با ساعت می‌گوید', async () => {
      await linked('chat-61');
      const today = new Date().toISOString().slice(0, 10);
      shiftRows = [
        {
          date: today,
          startTime: '07:00',
          endTime: '15:00',
          label: 'صبح',
          note: 'تحویلِ کلید',
        },
      ];
      const text = replyText(
        await service.tryHandle(BOT, 'chat-61', '🗓 شیفتِ من'),
      );
      expect(text).toContain('07:00');
      expect(text).toContain('صبح');
      expect(text).toContain('تحویلِ کلید');
      // شیفتِ همین امروز «امروز» خوانده می‌شود، نه تاریخِ خام.
      expect(text).toContain('امروز');
    });

    it('ثبتِ ورود ساعت را تأیید می‌کند', async () => {
      await linked('chat-62');
      const text = replyText(
        await service.tryHandle(BOT, 'chat-62', '🟢 ثبتِ ورود'),
      );
      expect(text).toContain('07:05');
      expect(text).toContain('ثبت شد');
    });

    it('ثبتِ خروج کارکرد را می‌گوید', async () => {
      await linked('chat-63');
      const text = replyText(
        await service.tryHandle(BOT, 'chat-63', '🔴 ثبتِ خروج'),
      );
      expect(text).toContain('15:00');
      expect(text).toContain('8 ساعت');
    });

    it('خطای ثبتِ حضور به کاربر گفته می‌شود', async () => {
      await linked('chat-64');
      punchError = { response: { message: 'ابتدا ورود را ثبت کنید' } };
      const text = replyText(
        await service.tryHandle(BOT, 'chat-64', '🔴 ثبتِ خروج'),
      );
      expect(text).toContain('ابتدا ورود');
    });

    it('«خروج» منو با «ثبتِ خروج» قاطی نمی‌شود', async () => {
      await linked('chat-65');
      // دکمهٔ خروجِ منو باید اتصال را قطع کند، نه حضور ثبت کند.
      const text = replyText(
        await service.tryHandle(BOT, 'chat-65', '🚪 خروج'),
      );
      expect(text).toContain('قطع شد');
      expect(await hr.findByChat('chat-65', 'bale')).toBeNull();
    });
  });

  describe('نامه‌ها و کارهای چندمرحله‌ای در ربات', () => {
    const linkStaff = async (mobile: string, chatId: string) => {
      await hr.create(ORG, { fullName: 'کارمندِ نامه', mobile });
      await service.tryHandle(BOT, chatId, mobile);
    };

    it('پیامِ وسطِ یک کارِ باز به همان کار می‌رود، نه به منو', async () => {
      await linkStaff('09120000041', 'chat-41');
      flowReply = { text: 'تا چه تاریخی؟' };
      const reply = await service.tryHandle(BOT, 'chat-41', '/me');
      expect(replyText(reply)).toBe('تا چه تاریخی؟');
    });

    it('«✉️ نامه‌های من» با صندوقِ خالی پیامِ روشن می‌دهد', async () => {
      await linkStaff('09120000042', 'chat-42');
      const reply = await service.tryHandle(BOT, 'chat-42', '✉️ نامه‌های من');
      expect(replyText(reply)).toContain('نامه‌ای ندارید');
    });

    it('صندوق را با شمارِ نخوانده و دکمهٔ هر نامه نشان می‌دهد', async () => {
      await linkStaff('09120000043', 'chat-43');
      letterRows = [
        { id: 'L1', number: 'N-1', subject: 'جلسه', senderName: 'مدیر', isUnread: true, priority: 'urgent', body: 'ساعت ۹' },
        { id: 'L2', number: 'N-2', subject: 'گزارش', senderName: 'HR', isUnread: false, priority: 'normal', body: '' },
      ];
      const reply = await service.tryHandle(BOT, 'chat-43', '/letters');
      const text = replyText(reply);
      expect(text).toContain('1 نخوانده');
      expect(text).toContain('N-1');
      expect(text).toContain('فوری');
      expect(JSON.stringify(reply)).toContain('📬 N-2');
    });

    it('باز کردنِ نامه آن را خوانده می‌کند و دکمهٔ پاسخ می‌دهد', async () => {
      await linkStaff('09120000044', 'chat-44');
      letterRows = [
        { id: 'L9', number: 'N-9', subject: 'تمدید', senderName: 'مدیر', isUnread: true, priority: 'normal', body: 'متنِ نامه' },
      ];
      const reply = await service.tryHandle(BOT, 'chat-44', '📬 N-9');
      expect(replyText(reply)).toContain('متنِ نامه');
      expect(markReadCalls).toEqual(['L9']);
      expect(JSON.stringify(reply)).toContain('↩️ N-9');
    });

    it('«اعلامِ خرابی» و «درخواستِ مرخصی» کارِ مربوط را برای همین پرسنل شروع می‌کنند', async () => {
      await linkStaff('09120000045', 'chat-45');
      await service.tryHandle(BOT, 'chat-45', '🛠 اعلامِ خرابی');
      await service.tryHandle(BOT, 'chat-45', '🌴 درخواستِ مرخصی');
      expect(flowStarts.map((f) => f.flow)).toEqual(['fault', 'leave']);
      expect(flowStarts[0]).toMatchObject({ organizationId: ORG, chatId: 'chat-45', platform: 'bale' });
    });

    it('پاسخ به نامه کارِ LETTER_REPLY را با شناسهٔ همان نامه شروع می‌کند', async () => {
      await linkStaff('09120000046', 'chat-46');
      letterRows = [
        { id: 'L7', number: 'N-7', subject: 'x', senderName: 'y', isUnread: false, priority: 'normal', body: '' },
      ];
      await service.tryHandle(BOT, 'chat-46', '↩️ N-7');
      expect(flowStarts).toEqual([
        expect.objectContaining({ flow: 'letter_reply', contextId: 'L7' }),
      ]);
    });

    it('«↩️ بازگشت» با پیشوندِ دکمهٔ پاسخ اشتباه گرفته نمی‌شود', async () => {
      // هر دو با «↩️ » شروع می‌شوند؛ بازگشت باید پیش از پیشوندِ پاسخ بررسی شود.
      await linkStaff('09120000047', 'chat-47');
      await service.tryHandle(BOT, 'chat-47', '↩️ بازگشت');
      expect(flowStarts).toEqual([]);
      expect(inboxSearches).not.toContain('بازگشت');
    });

    it('کاربرِ وصل‌نشده نمی‌تواند نامه ببیند یا کار شروع کند', async () => {
      const reply = await service.tryHandle(BOT, 'chat-48', '/letters');
      expect(replyText(reply)).not.toContain('نامه‌های شما');
      await service.tryHandle(BOT, 'chat-48', '🛠 اعلامِ خرابی');
      expect(flowStarts).toEqual([]);
    });
  });
});

/** متنِ پاسخ را از رشته یا شیءِ {text,keyboard} بیرون می‌کشد. */
function replyText(reply: unknown): string {
  if (typeof reply === 'string') return reply;
  if (reply && typeof reply === 'object' && 'text' in reply) {
    return String((reply as { text: string }).text);
  }
  return '';
}
