jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));
// @nestjs/jwt فایلِ ESM است و Jest آن را بار نمی‌کند؛ سرویس فقط نوعش را برای
// تزریق لازم دارد و تست استابِ خودش را می‌دهد.
jest.mock('@nestjs/jwt', () => ({ JwtService: class {} }));

import type { DataSource } from 'typeorm';
import { PersonnelEntity } from '../database/entities/personnel.entity';
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

  beforeEach(async () => {
    ds = await createTestDataSource();
    hr = new HrService(ds.getRepository(PersonnelEntity));
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
    expect(linked?.botPlatform).toBe('bale');
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
      // لینک حاملِ توکنِ هویت (rt) است و دکمه‌ی مینی‌اپ دارد.
      expect(replyText(reply)).toContain('#rt=');
      const kb = (reply as { keyboard?: { inline_keyboard?: unknown[] } })
        .keyboard;
      expect(Array.isArray(kb?.inline_keyboard)).toBe(true);
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
});

/** متنِ پاسخ را از رشته یا شیءِ {text,keyboard} بیرون می‌کشد. */
function replyText(reply: unknown): string {
  if (typeof reply === 'string') return reply;
  if (reply && typeof reply === 'object' && 'text' in reply) {
    return String((reply as { text: string }).text);
  }
  return '';
}
