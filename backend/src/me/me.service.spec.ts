jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));
// @nestjs/jwt فایلِ ESM است و Jest آن را بار نمی‌کند؛ این سرویس تنها از راهِ
// وارداتِ زنجیره‌ای به آن می‌رسد و در این آزمون‌ها نقشی ندارد.
jest.mock('@nestjs/jwt', () => ({ JwtService: class {} }));

import type { DataSource } from 'typeorm';
import { createTestDataSource } from '../testing/test-database';
import { PersonnelEntity } from '../database/entities/personnel.entity';
import { PersonnelBotLinkEntity } from '../database/entities/personnel-bot-link.entity';
import {
  LeaveBalanceEntity,
  LeaveRequestEntity,
  LeaveType,
} from '../database/entities/leave-request.entity';
import { WorkspaceEntity } from '../database/entities/workspace.entity';
import { TelegramIntegrationEntity } from '../database/entities/telegram-integration.entity';
import { HrService } from '../hr/hr.service';
import { LeaveService } from '../hr/leave.service';
import { MeService } from './me.service';

const ORG = 'org-1';
const USER = 'user-1';

describe('MeService', () => {
  let ds: DataSource;
  let me: MeService;
  let hr: HrService;
  let leaves: LeaveService;
  let mine: PersonnelEntity;
  let colleague: PersonnelEntity;

  beforeEach(async () => {
    ds = await createTestDataSource();
    hr = new HrService(
      ds.getRepository(PersonnelEntity),
      ds.getRepository(PersonnelBotLinkEntity),
    );
    leaves = new LeaveService(
      ds.getRepository(LeaveRequestEntity),
      ds.getRepository(LeaveBalanceEntity),
      ds.getRepository(PersonnelEntity),
    );
    me = new MeService(
      hr,
      // کدِ اتصال در این آزمون‌ها نقشی ندارد.
      { createPersonnelLinkCode: async () => ({ code: 'X' }) } as never,
      ds.getRepository(WorkspaceEntity),
      ds.getRepository(TelegramIntegrationEntity),
      leaves,
    );

    mine = await hr.create(ORG, { fullName: 'زهرا' });
    colleague = await hr.create(ORG, { fullName: 'همکار' });
    await hr.setUserLink(ORG, mine.id, USER);
  });

  afterEach(async () => {
    await ds.destroy();
  });

  describe('مرخصیِ خودسرویس', () => {
    it('مرخصی به نامِ خودِ کاربر ثبت می‌شود', async () => {
      const saved = await me.requestLeave(ORG, USER, {
        fromDate: '2026-12-01',
        toDate: '2026-12-02',
        type: LeaveType.ANNUAL,
        reason: 'کارِ شخصی',
      });
      expect(saved.personnelId).toBe(mine.id);
      expect(saved.days).toBe(2);
    });

    it('`personnelId`ِ فرستاده‌شده نادیده گرفته می‌شود', async () => {
      /*
       * قاعدهٔ امنیتیِ این مسیر: کسی نباید بتواند به نامِ همکارش مرخصی
       * ثبت کند. هر چه کلاینت بفرستد بی‌اثر است و پرونده از توکن می‌آید.
       */
      const saved = await me.requestLeave(ORG, USER, {
        fromDate: '2026-12-05',
        toDate: '2026-12-05',
        type: LeaveType.ANNUAL,
        personnelId: colleague.id,
      } as never);

      expect(saved.personnelId).toBe(mine.id);
      expect(saved.personnelId).not.toBe(colleague.id);
    });

    it('حسابِ وصل‌نشده خطای راهنما می‌گیرد', async () => {
      await expect(
        me.requestLeave(ORG, 'user-without-personnel', {
          fromDate: '2026-12-01',
          toDate: '2026-12-02',
        }),
      ).rejects.toThrow('منابع انسانی');
    });

    it('قاعده‌های مرخصی همان قاعده‌های سرویسِ مرخصی است', async () => {
      await me.requestLeave(ORG, USER, {
        fromDate: '2026-12-10',
        toDate: '2026-12-12',
        type: LeaveType.ANNUAL,
      });
      // مرخصیِ هم‌پوشان رد می‌شود؛ منطق در یک جا می‌ماند، نه دو جا.
      await expect(
        me.requestLeave(ORG, USER, {
          fromDate: '2026-12-11',
          toDate: '2026-12-11',
          type: LeaveType.ANNUAL,
        }),
      ).rejects.toThrow();
    });
  });

  describe('پروفایل', () => {
    it('حسابِ وصل‌نشده صریح اعلام می‌شود', async () => {
      const result = await me.profile(ORG, 'nobody');
      expect(result.linked).toBe(false);
      expect(result.personnel).toBeNull();
      // سکوهای پشتیبانی‌شده همیشه برمی‌گردند تا پنل بتواند راهنما بدهد.
      expect(result.platforms.length).toBeGreaterThan(0);
    });

    it('پروفایلِ وصل‌شده پرونده و سکوها را می‌دهد', async () => {
      await hr.linkChatToPersonnel(ORG, mine.id, 'bale', 'chat-1', 'ws-1');
      const result = await me.profile(ORG, USER);

      expect(result.linked).toBe(true);
      expect(result.personnel?.fullName).toBe('زهرا');
      expect(result.botLinks.map((l) => l.platform)).toEqual(['bale']);
      /*
       * شناسهٔ گفتگو برنمی‌گردد: برای کاربر بی‌معناست و دانستنش فقط به
       * کسی کمک می‌کند که بخواهد جایی دیگر جعلش کند.
       */
      expect(JSON.stringify(result.botLinks)).not.toContain('chat-1');
    });
  });

  describe('قطعِ پیام‌رسان', () => {
    it('سکوی ناشناخته رد می‌شود', async () => {
      await expect(me.removeBotLink(ORG, USER, 'whatsapp')).rejects.toThrow(
        'شناخته نمی‌شود',
      );
    });

    it('سکوی وصل‌شده قطع می‌شود', async () => {
      await hr.linkChatToPersonnel(ORG, mine.id, 'bale', 'chat-1', 'ws-1');
      expect((await me.removeBotLink(ORG, USER, 'bale')).unlinked).toBe(true);
      expect((await hr.linksOf(ORG, mine.id)).length).toBe(0);
    });
  });
});
