jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import type { DataSource } from 'typeorm';
import { PersonnelEntity } from '../database/entities/personnel.entity';
import type { TelegramIntegrationEntity } from '../database/entities/telegram-integration.entity';
import { createTestDataSource } from '../testing/test-database';
import { HrService } from '../hr/hr.service';
import { StaffBotService, looksLikeMobile } from './staff-bot.service';

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
    service = new StaffBotService(workspaces, hr, announcements);
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
    expect(reply).toContain('زهرا محمدی');

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
});
