jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import type { DataSource } from 'typeorm';
import { PersonnelEntity } from '../database/entities/personnel.entity';
import { PersonnelBotLinkEntity } from '../database/entities/personnel-bot-link.entity';
import { createTestDataSource } from '../testing/test-database';
import { HrService } from '../hr/hr.service';
import { StaffNotifyService } from './staff-notify.service';

const ORG = 'org-1';
const WS = 'ws-1';

describe('StaffNotifyService', () => {
  let ds: DataSource;
  let hr: HrService;
  let sends: Array<{ chatId: string; text: string; base: string }>;
  let bot: { botToken: string; isActive: boolean; platform: string } | null;

  const make = () => {
    const botRepo = { findOne: async () => bot } as never;
    const api = {
      send: async (_t: string, chatId: string, text: string, base: string) => {
        sends.push({ chatId, text, base });
        return { ok: true };
      },
    } as never;
    return new StaffNotifyService(botRepo, hr, api);
  };

  const linkedPerson = async (
    mobile: string,
    chatId: string,
    opts: { name?: string; departmentId?: string } = {},
  ) => {
    await hr.create(ORG, {
      fullName: opts.name ?? 'کارمند',
      mobile,
      departmentId: opts.departmentId,
    });
    await hr.linkBotChat(ORG, mobile, chatId, 'bale', WS);
  };

  beforeEach(async () => {
    ds = await createTestDataSource();
    hr = new HrService(
      ds.getRepository(PersonnelEntity),
      ds.getRepository(PersonnelBotLinkEntity),
    );
    sends = [];
    bot = { botToken: 'TKN', isActive: true, platform: 'bale' };
  });

  it('به پرسنلِ وصل‌به‌ربات، نتیجهٔ تأیید را می‌فرستد', async () => {
    await linkedPerson('09120000001', 'chat-1');
    await make().notifyReviewDecision({
      organizationId: ORG,
      workspaceId: WS,
      respondentKey: '09120000001',
      formTitle: 'درخواست مرخصی',
      decision: 'approved',
    });
    expect(sends).toHaveLength(1);
    expect(sends[0].chatId).toBe('chat-1');
    expect(sends[0].text).toContain('تأیید');
    expect(sends[0].text).toContain('درخواست مرخصی');
    // بله نشانیِ پایه‌ی خودش را می‌گیرد.
    expect(sends[0].base).toContain('bale');
  });

  it('ردِ درخواست هم اعلان می‌شود', async () => {
    await linkedPerson('09120000002', 'chat-2');
    await make().notifyReviewDecision({
      organizationId: ORG,
      workspaceId: WS,
      respondentKey: '0912 000 0002',
      formTitle: 'مرخصی',
      decision: 'rejected',
      note: 'سقف مرخصی پر است',
    });
    expect(sends[0].text).toContain('رد');
    expect(sends[0].text).toContain('سقف مرخصی پر است');
  });

  it('پاسخ‌دهنده‌ی بی‌نام یا ناشناخته اعلان نمی‌شود', async () => {
    const svc = make();
    await svc.notifyReviewDecision({
      organizationId: ORG,
      workspaceId: WS,
      respondentKey: null,
      formTitle: 'x',
      decision: 'approved',
    });
    await svc.notifyReviewDecision({
      organizationId: ORG,
      workspaceId: WS,
      respondentKey: '09129999999',
      formTitle: 'x',
      decision: 'approved',
    });
    expect(sends).toHaveLength(0);
  });

  it('پرسنلِ وصل‌نشده (بدونِ گفتگو) اعلان نمی‌شود', async () => {
    await hr.create(ORG, { fullName: 'بی‌ربات', mobile: '09120000003' });
    await make().notifyReviewDecision({
      organizationId: ORG,
      workspaceId: WS,
      respondentKey: '09120000003',
      formTitle: 'x',
      decision: 'approved',
    });
    expect(sends).toHaveLength(0);
  });

  it('وقتی رباتِ فعالی برای فضا نیست، اعلان نمی‌شود', async () => {
    await linkedPerson('09120000004', 'chat-4');
    bot = null;
    await make().notifyReviewDecision({
      organizationId: ORG,
      workspaceId: WS,
      respondentKey: '09120000004',
      formTitle: 'x',
      decision: 'approved',
    });
    expect(sends).toHaveLength(0);
  });

  describe('اطلاعیهٔ سازمانی', () => {
    it('به همهٔ پرسنلِ وصل‌به‌ربات می‌رود', async () => {
      await linkedPerson('09120000010', 'chat-a', { name: 'الف' });
      await linkedPerson('09120000011', 'chat-b', { name: 'ب' });
      // پرسنلِ وصل‌نشده نباید گیرنده باشد.
      await hr.create(ORG, { fullName: 'ج', mobile: '09120000012' });

      const res = await make().broadcastAnnouncement({
        organizationId: ORG,
        title: 'جلسهٔ فردا',
        body: 'ساعت ۹ در لابی.',
      });
      expect(res.sent).toBe(2);
      expect(sends.map((s) => s.chatId).sort()).toEqual(['chat-a', 'chat-b']);
      expect(sends[0].text).toContain('جلسهٔ فردا');
      expect(sends[0].text).toContain('لابی');
    });

    it('با بخش فیلتر می‌شود', async () => {
      await linkedPerson('09120000013', 'chat-c', {
        name: 'فنی',
        departmentId: 'dept-1',
      });
      await linkedPerson('09120000014', 'chat-d', {
        name: 'خانه‌داری',
        departmentId: 'dept-2',
      });

      const res = await make().broadcastAnnouncement({
        organizationId: ORG,
        title: 'فقط فنی',
        body: 'تعمیرات',
        departmentId: 'dept-1',
      });
      expect(res.sent).toBe(1);
      expect(sends[0].chatId).toBe('chat-c');
    });

    it('بدونِ گیرنده، صفر می‌دهد', async () => {
      const res = await make().broadcastAnnouncement({
        organizationId: ORG,
        title: 'x',
        body: 'y',
      });
      expect(res).toEqual({ sent: 0, skipped: 0 });
      expect(sends).toHaveLength(0);
    });
  });

  describe('اعلانِ نتیجهٔ مرخصی', () => {
    const leave = (personnelId: string, decision: 'approved' | 'rejected' | 'cancelled', note?: string) =>
      make().notifyLeaveDecision({
        organizationId: ORG,
        personnelId,
        number: 'LV-00007',
        decision,
        fromDate: '2025-08-03',
        toDate: '2025-08-05',
        note,
      });

    it('تأیید به همهٔ سکوهای وصل‌شدهٔ همان نفر می‌رود', async () => {
      const person = await hr.create(ORG, { fullName: 'دوسکویی' });
      await hr.linkChatToPersonnel(ORG, person.id, 'bale', 'c-bale', WS);
      await hr.linkChatToPersonnel(ORG, person.id, 'telegram', 'c-tg', WS);

      await leave(person.id, 'approved', 'سفر خوش');

      expect(sends.map((x) => x.chatId).sort()).toEqual(['c-bale', 'c-tg']);
      const text = sends[0].text;
      expect(text).toContain('تأیید شد');
      expect(text).toContain('LV-00007');
      expect(text).toContain('2025-08-03');
      expect(text).toContain('سفر خوش');
    });

    it('رد با عنوانِ درست', async () => {
      const person = await hr.create(ORG, { fullName: 'یک‌سکویی' });
      await hr.linkChatToPersonnel(ORG, person.id, 'bale', 'c1', WS);
      await leave(person.id, 'rejected');
      expect(sends).toHaveLength(1);
      expect(sends[0].text).toContain('رد شد');
    });

    it('بی‌ربات یا رباتِ غیرفعال: چیزی نمی‌رود و خطا هم نمی‌دهد', async () => {
      const alone = await hr.create(ORG, { fullName: 'بی‌ربات' });
      await expect(leave(alone.id, 'approved')).resolves.toBeUndefined();

      const person = await hr.create(ORG, { fullName: 'رباتِ خاموش' });
      await hr.linkChatToPersonnel(ORG, person.id, 'bale', 'c2', WS);
      bot = { botToken: 'TKN', isActive: false, platform: 'bale' };
      await leave(person.id, 'approved');
      expect(sends).toHaveLength(0);
    });
  });
});
