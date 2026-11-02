jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import type { DataSource } from 'typeorm';
import { createTestDataSource } from '../testing/test-database';
import { PersonnelEntity } from '../database/entities/personnel.entity';
import {
  StaffReminderKind,
  StaffReminderLogEntity,
} from '../database/entities/work-shift.entity';
import { TelegramIntegrationEntity } from '../database/entities/telegram-integration.entity';
import { WorkspaceEntity } from '../database/entities/workspace.entity';
import { PersonnelBotLinkEntity } from '../database/entities/personnel-bot-link.entity';
import { OrganizationEntity } from '../database/entities/organization.entity';
import { StaffReminderService } from './staff-reminder.service';

/** ساعتِ پیش‌فرضِ ارسال در سرویس (UTC). */
const TASKS_HOUR = 3;
const SHIFT_HOUR = 14;

/** یک زمانِ مشخص در همان ساعتِ UTC. */
const at = (hourUtc: number) =>
  new Date(`${new Date().toISOString().slice(0, 10)}T${String(hourUtc).padStart(2, '0')}:05:00Z`);

describe('StaffReminderService', () => {
  let ds: DataSource;
  let service: StaffReminderService;
  /** پیام‌هایی که به API رفتند. */
  let sentMessages: Array<{ chatId: string; text: string }>;
  /** پاسخِ بعدیِ API؛ برای آزمونِ شکستِ ارسال. */
  let sendOk = true;
  let tasks: Array<Record<string, unknown>>;
  let shiftRows: Array<Record<string, unknown>>;
  /** تعدادِ نامه‌های نخواندهٔ هر پرسنل (کلید: personnelId). */
  let unreadLetters: Record<string, number>;
  let orgId: string;
  let workspaceId: string;

  /**
   * پرسنلِ وصل‌به‌ربات.
   *
   * اتصال سطرِ جدولِ `personnel_bot_links` است، نه ستونِ منسوخِ روی
   * `personnel`؛ `platform` پارامتر است تا بتوان یک نفر را روی دو سکو
   * وصل کرد.
   */
  const linkedPerson = async (
    fullName: string,
    chatId: string,
    platform = 'bale',
    ws: string | null | undefined = undefined,
  ) => {
    const person = await ds.getRepository(PersonnelEntity).save({
      organizationId: orgId,
      fullName,
      isActive: true,
    });
    await ds.getRepository(PersonnelBotLinkEntity).save({
      organizationId: orgId,
      personnelId: person.id,
      platform,
      chatId,
      workspaceId: ws === undefined ? workspaceId : ws,
    });
    return person;
  };

  beforeEach(async () => {
    ds = await createTestDataSource();
    sentMessages = [];
    sendOk = true;
    tasks = [];
    unreadLetters = {};
    shiftRows = [];

    const org = await ds
      .getRepository(OrganizationEntity)
      .save({ name: 'هتل' });
    orgId = org.id;
    const ws = await ds
      .getRepository(WorkspaceEntity)
      .save({ organizationId: orgId, name: 'فضا' });
    workspaceId = ws.id;
    await ds.getRepository(TelegramIntegrationEntity).save({
      workspaceId,
      botToken: 'tok',
      platform: 'bale',
      isActive: true,
    });

    service = new StaffReminderService(
      ds.getRepository(PersonnelEntity),
      ds.getRepository(StaffReminderLogEntity),
      ds.getRepository(TelegramIntegrationEntity),
      ds.getRepository(WorkspaceEntity),
      ds.getRepository(PersonnelBotLinkEntity),
      { myShifts: async () => shiftRows } as never,
      { workOrdersOfTechnician: async () => tasks } as never,
      {
        unreadCount: async (_org: string, personnelId: string) =>
          unreadLetters[personnelId] ?? 0,
      } as never,
      {
        send: async (_token: string, chatId: string, text: string) => {
          if (sendOk) sentMessages.push({ chatId, text });
          return { ok: sendOk };
        },
      } as never,
    );
  });

  afterEach(async () => {
    await ds.destroy();
  });

  it('بیرونِ ساعتِ ارسال چیزی نمی‌فرستد', async () => {
    await linkedPerson('کارمند', 'chat-1');
    tasks = [{ number: 'WO-1', title: 'کار', priority: 'normal', dueDate: '' }];

    // ساعتی که نه ساعتِ کار است و نه ساعتِ شیفت.
    expect(await service.run(at(9))).toBe(0);
    expect(sentMessages).toHaveLength(0);
  });

  it('صبح، کارهای سپرده‌شده را یادآوری می‌کند', async () => {
    await linkedPerson('تکنسین', 'chat-2');
    tasks = [
      {
        number: 'WO-00007',
        title: 'تعمیرِ آسانسور',
        priority: 'emergency',
        dueDate: '2020-01-01',
      },
    ];

    expect(await service.run(at(TASKS_HOUR))).toBe(1);
    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0].chatId).toBe('chat-2');
    expect(sentMessages[0].text).toContain('WO-00007');
    expect(sentMessages[0].text).toContain('تعمیرِ آسانسور');
    // اولویت و عقب‌افتادگی باید در متن باشد، وگرنه یادآوری بی‌فایده است.
    expect(sentMessages[0].text).toContain('اضطراری');
    expect(sentMessages[0].text).toContain('عقب‌افتاده');
  });

  it('صبح، نامه‌های نخوانده را جدا از کارها یادآوری می‌کند', async () => {
    const reader = await linkedPerson('منشی', 'chat-9');
    unreadLetters[reader.id] = 3;

    expect(await service.run(at(TASKS_HOUR))).toBe(1);
    expect(sentMessages).toHaveLength(1);
    expect(sentMessages[0].chatId).toBe('chat-9');
    expect(sentMessages[0].text).toContain('نامهٔ نخوانده');
    // بی‌کار است، پس پیامِ خالیِ «کارها» نباید برود.
    expect(sentMessages[0].text).not.toContain('WO-');
    // همان روز دوباره نمی‌رود.
    expect(await service.run(at(TASKS_HOUR))).toBe(0);
  });

  it('بدونِ نامهٔ نخوانده، یادآوریِ نامه نمی‌رود', async () => {
    await linkedPerson('بی‌نامه', 'chat-10');
    expect(await service.run(at(TASKS_HOUR))).toBe(0);
    expect(sentMessages).toHaveLength(0);
  });

  it('عصر، شیفتِ فردا را یادآوری می‌کند', async () => {
    await linkedPerson('نگهبان', 'chat-3');
    shiftRows = [
      { startTime: '23:00', endTime: '07:00', label: 'شب', note: '' },
    ];

    expect(await service.run(at(SHIFT_HOUR))).toBe(1);
    expect(sentMessages[0].text).toContain('شیفتِ فردا');
    expect(sentMessages[0].text).toContain('23:00');
    expect(sentMessages[0].text).toContain('شب');
  });

  it('یادآوری در یک روز دوبار نمی‌رود', async () => {
    await linkedPerson('کارمند', 'chat-4');
    tasks = [{ number: 'WO-1', title: 'کار', priority: 'normal', dueDate: '' }];

    expect(await service.run(at(TASKS_HOUR))).toBe(1);
    // اجرای دوباره در همان روز — زمان‌بند هر ربع‌ساعت اجرا می‌شود.
    expect(await service.run(at(TASKS_HOUR))).toBe(0);
    expect(sentMessages).toHaveLength(1);
    expect(await ds.getRepository(StaffReminderLogEntity).count()).toBe(1);
  });

  it('کار و شیفت دفترِ جدا دارند', async () => {
    await linkedPerson('کارمند', 'chat-5');
    tasks = [{ number: 'WO-1', title: 'کار', priority: 'normal', dueDate: '' }];
    shiftRows = [
      { startTime: '07:00', endTime: '15:00', label: 'صبح', note: '' },
    ];

    await service.run(at(TASKS_HOUR));
    await service.run(at(SHIFT_HOUR));
    // دو پیامِ متفاوت، چون دو موضوعِ متفاوت‌اند.
    expect(sentMessages).toHaveLength(2);
    const kinds = (
      await ds.getRepository(StaffReminderLogEntity).find()
    ).map((r) => r.kind);
    expect(kinds).toContain(StaffReminderKind.TASKS);
    expect(kinds).toContain(StaffReminderKind.SHIFT);
  });

  it('بی‌کار و بی‌شیفت، پیامِ خالی نمی‌رود و دفتر هم نوشته نمی‌شود', async () => {
    await linkedPerson('بی‌کار', 'chat-6');

    expect(await service.run(at(TASKS_HOUR))).toBe(0);
    expect(sentMessages).toHaveLength(0);
    /*
     * دفتر خالی می‌ماند تا اگر همان روز کاری به او سپرده شد، یادآوریِ
     * بعدی برود؛ وگرنه «پیامی نداشتیم» با «فرستادیم» یکی می‌شد.
     */
    expect(await ds.getRepository(StaffReminderLogEntity).count()).toBe(0);
  });

  it('شکستِ ارسال در دفتر ثبت نمی‌شود تا دوباره تلاش شود', async () => {
    await linkedPerson('کارمند', 'chat-7');
    tasks = [{ number: 'WO-1', title: 'کار', priority: 'normal', dueDate: '' }];
    sendOk = false;

    expect(await service.run(at(TASKS_HOUR))).toBe(0);
    expect(await ds.getRepository(StaffReminderLogEntity).count()).toBe(0);

    // دفعهٔ بعد که شبکه برگشت، پیام می‌رود.
    sendOk = true;
    expect(await service.run(at(TASKS_HOUR))).toBe(1);
  });

  it('پرسنلِ وصل‌نشده یا غیرفعال یادآوری نمی‌گیرد', async () => {
    tasks = [{ number: 'WO-1', title: 'کار', priority: 'normal', dueDate: '' }];
    // بی‌اتصالِ ربات.
    await ds.getRepository(PersonnelEntity).save({
      organizationId: orgId,
      fullName: 'بی‌ربات',
      isActive: true,
    });
    // وصل، ولی غیرفعال.
    const gone = await ds.getRepository(PersonnelEntity).save({
      organizationId: orgId,
      fullName: 'رفته',
      isActive: false,
    });
    await ds.getRepository(PersonnelBotLinkEntity).save({
      organizationId: orgId,
      personnelId: gone.id,
      platform: 'bale',
      chatId: 'chat-8',
      workspaceId,
    });

    expect(await service.run(at(TASKS_HOUR))).toBe(0);
    expect(sentMessages).toHaveLength(0);
  });

  it('رباتِ غیرفعال، یادآوری نمی‌فرستد', async () => {
    await linkedPerson('کارمند', 'chat-9');
    tasks = [{ number: 'WO-1', title: 'کار', priority: 'normal', dueDate: '' }];
    await ds
      .getRepository(TelegramIntegrationEntity)
      .update({ workspaceId }, { isActive: false });

    expect(await service.run(at(TASKS_HOUR))).toBe(0);
  });

  it('اتصالِ قدیمیِ بی‌فضای‌کاری هم یادآوری می‌گیرد', async () => {
    // اتصالی که فضای کاری‌اش ثبت نشده (اتصال‌های قدیمیِ منتقل‌شده).
    await linkedPerson('اتصالِ قدیمی', 'chat-10', 'bale', null);
    tasks = [{ number: 'WO-1', title: 'کار', priority: 'normal', dueDate: '' }];

    expect(await service.run(at(TASKS_HOUR))).toBe(1);
    expect(sentMessages[0].chatId).toBe('chat-10');
  });
});
