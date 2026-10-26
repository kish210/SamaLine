jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import type { DataSource } from 'typeorm';
import { PersonnelEntity } from '../database/entities/personnel.entity';
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

  const linkedPerson = async (mobile: string, chatId: string) => {
    await hr.create(ORG, { fullName: 'کارمند', mobile });
    await hr.linkBotChat(ORG, mobile, chatId, 'bale');
  };

  beforeEach(async () => {
    ds = await createTestDataSource();
    hr = new HrService(ds.getRepository(PersonnelEntity));
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
});
