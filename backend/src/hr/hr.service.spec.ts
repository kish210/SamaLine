jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import { BadRequestException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { PersonnelEntity } from '../database/entities/personnel.entity';
import { PersonnelBotLinkEntity } from '../database/entities/personnel-bot-link.entity';
import { createTestDataSource } from '../testing/test-database';
import { HrService } from './hr.service';

const ORG = 'org-1';

describe('HrService', () => {
  let ds: DataSource;
  let service: HrService;

  beforeEach(async () => {
    ds = await createTestDataSource();
    service = new HrService(
      ds.getRepository(PersonnelEntity),
      ds.getRepository(PersonnelBotLinkEntity),
    );
  });

  it('پرسنل می‌سازد و فهرستِ مرتب بر اساس نام برمی‌گرداند', async () => {
    await service.create(ORG, { fullName: 'زهرا محمدی' });
    await service.create(ORG, { fullName: 'احمد رضایی' });
    const list = await service.list(ORG);
    expect(list.map((p) => p.fullName)).toEqual(['احمد رضایی', 'زهرا محمدی']);
  });

  it('نام خالی رد می‌شود', async () => {
    await expect(service.create(ORG, { fullName: '  ' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('موبایل را فقط رقم نگه می‌دارد و یکتاییِ سازمانی را اعمال می‌کند', async () => {
    const p = await service.create(ORG, {
      fullName: 'علی',
      mobile: '0912-345-6789',
    });
    expect(p.mobile).toBe('09123456789');
    await expect(
      service.create(ORG, { fullName: 'حسن', mobile: '0912 345 6789' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('همان موبایل در سازمان دیگر مجاز است', async () => {
    await service.create(ORG, { fullName: 'الف', mobile: '09120000000' });
    const other = await service.create('org-2', {
      fullName: 'ب',
      mobile: '09120000000',
    });
    expect(other.mobile).toBe('09120000000');
  });

  it('چند پرسنلِ بدونِ موبایل مجاز است', async () => {
    await service.create(ORG, { fullName: 'یک' });
    const two = await service.create(ORG, { fullName: 'دو' });
    expect(two.mobile).toBe('');
  });

  it('findByMobile پرسنل را با نگارشِ متفاوتِ موبایل پیدا می‌کند', async () => {
    const p = await service.create(ORG, {
      fullName: 'سارا',
      mobile: '09121112233',
    });
    const found = await service.findByMobile(ORG, '0912-111-2233');
    expect(found?.id).toBe(p.id);
    expect(await service.findByMobile('org-2', '09121112233')).toBeNull();
  });

  it('تاریخِ استخدامِ نامعتبر خالی می‌شود، معتبر می‌ماند', async () => {
    const bad = await service.create(ORG, {
      fullName: 'الف',
      hireDate: '1403/01/01',
    });
    expect(bad.hireDate).toBe('');
    const good = await service.create(ORG, {
      fullName: 'ب',
      hireDate: '2024-03-21',
    });
    expect(good.hireDate).toBe('2024-03-21');
  });

  it('مدارک/فایل‌ها ذخیره و خوانده می‌شود', async () => {
    const p = await service.create(ORG, {
      fullName: 'رضا',
      documents: [{ name: 'قرارداد', url: '/f/1.pdf' }],
    });
    const fetched = (await service.list(ORG)).find((x) => x.id === p.id)!;
    expect(fetched.documents).toEqual([{ name: 'قرارداد', url: '/f/1.pdf' }]);
  });

  it('پرسنلِ سازمان دیگر را نمی‌شود ویرایش یا حذف کرد', async () => {
    const mine = await service.create(ORG, { fullName: 'من' });
    await expect(
      service.update('org-2', mine.id, { position: 'سرایدار' }),
    ).rejects.toThrow('یافت نشد');
    await expect(service.remove('org-2', mine.id)).rejects.toThrow('یافت نشد');
  });
  describe('اتصالِ حسابِ کاربری', () => {
    it('حسابِ کاربری به پرونده وصل و قطع می‌شود', async () => {
      const person = await service.create(ORG, { fullName: 'زهرا' });
      const linked = await service.setUserLink(ORG, person.id, 'user-1');
      expect(linked.userId).toBe('user-1');
      expect((await service.findByUser(ORG, 'user-1'))?.id).toBe(person.id);

      const unlinked = await service.setUserLink(ORG, person.id, null);
      expect(unlinked.userId).toBeNull();
      expect(await service.findByUser(ORG, 'user-1')).toBeNull();
    });

    it('یک حسابِ کاربری به دو پرونده وصل نمی‌شود', async () => {
      const first = await service.create(ORG, { fullName: 'اول' });
      const second = await service.create(ORG, { fullName: 'دوم' });
      await service.setUserLink(ORG, first.id, 'user-1');
      await expect(
        service.setUserLink(ORG, second.id, 'user-1'),
      ).rejects.toThrow('اول');
      // وصل کردنِ دوبارهٔ همان حساب به همان پرونده مشکلی نیست.
      await expect(
        service.setUserLink(ORG, first.id, 'user-1'),
      ).resolves.toBeTruthy();
    });

    it('چند پرونده‌ی بی‌حسابِ کاربری مجاز است', async () => {
      await service.create(ORG, { fullName: 'الف' });
      await service.create(ORG, { fullName: 'ب' });
      // ایندکسِ یکتا روی NULL نمی‌گیرد؛ وگرنه فقط یک پرونده می‌شد ساخت.
      expect((await service.list(ORG)).length).toBe(2);
    });

    it('پروندهٔ سازمانِ دیگر وصل نمی‌شود', async () => {
      const mine = await service.create(ORG, { fullName: 'مالِ ما' });
      await expect(
        service.setUserLink('org-2', mine.id, 'user-9'),
      ).rejects.toThrow('یافت نشد');
    });

    it('حسابِ یکسان در دو سازمان مزاحمتی ندارد', async () => {
      const a = await service.create(ORG, { fullName: 'الف' });
      const b = await service.create('org-2', { fullName: 'ب' });
      await service.setUserLink(ORG, a.id, 'user-1');
      // یکتایی به‌ازای سازمان است، نه سراسری.
      await expect(
        service.setUserLink('org-2', b.id, 'user-1'),
      ).resolves.toBeTruthy();
    });
  });

  describe('اتصالِ چندسکوییِ پیام‌رسان', () => {
    it('یک نفر هم بله دارد هم تلگرام', async () => {
      const person = await service.create(ORG, { fullName: 'دوسکویی' });
      await service.linkChatToPersonnel(ORG, person.id, 'bale', 'c-bale', 'ws');
      await service.linkChatToPersonnel(
        ORG,
        person.id,
        'telegram',
        'c-tg',
        'ws',
      );

      const links = await service.linksOf(ORG, person.id);
      expect(links.map((l) => l.platform).sort()).toEqual(['bale', 'telegram']);
      // هر گفتگو مستقل به همان نفر می‌رسد.
      expect((await service.findByChat('c-bale', 'bale'))?.id).toBe(person.id);
      expect((await service.findByChat('c-tg', 'telegram'))?.id).toBe(
        person.id,
      );
    });

    it('اتصالِ تازه در همان سکو جایگزینِ قبلی می‌شود', async () => {
      const person = await service.create(ORG, { fullName: 'جابه‌جا' });
      await service.linkChatToPersonnel(ORG, person.id, 'bale', 'old', 'ws');
      await service.linkChatToPersonnel(ORG, person.id, 'bale', 'new', 'ws');

      expect(await service.findByChat('old', 'bale')).toBeNull();
      expect((await service.findByChat('new', 'bale'))?.id).toBe(person.id);
      expect((await service.linksOf(ORG, person.id)).length).toBe(1);
    });

    it('یک گفتگو به دو نفر وصل نمی‌ماند', async () => {
      const first = await service.create(ORG, { fullName: 'اول' });
      const second = await service.create(ORG, { fullName: 'دوم' });
      await service.linkChatToPersonnel(ORG, first.id, 'bale', 'chat', 'ws');
      await service.linkChatToPersonnel(ORG, second.id, 'bale', 'chat', 'ws');

      // گفتگو از نفرِ اول جدا می‌شود، وگرنه پیامِ شخصی به دو نفر می‌رفت.
      expect((await service.findByChat('chat', 'bale'))?.id).toBe(second.id);
      expect((await service.linksOf(ORG, first.id)).length).toBe(0);
    });

    it('قطعِ یک سکو بقیه را دست نمی‌زند', async () => {
      const person = await service.create(ORG, { fullName: 'دوسکویی' });
      await service.linkChatToPersonnel(ORG, person.id, 'bale', 'c1', 'ws');
      await service.linkChatToPersonnel(ORG, person.id, 'telegram', 'c2', 'ws');

      const { unlinked } = await service.unlinkPlatform(ORG, person.id, 'bale');
      expect(unlinked).toBe(true);
      expect(
        (await service.linksOf(ORG, person.id)).map((l) => l.platform),
      ).toEqual(['telegram']);
      // قطعِ چیزی که وصل نیست خطا نمی‌دهد، فقط false.
      expect(
        (await service.unlinkPlatform(ORG, person.id, 'bale')).unlinked,
      ).toBe(false);
    });

    it('پرسنلِ غیرفعال یا سازمانِ دیگر وصل نمی‌شود', async () => {
      const inactive = await service.create(ORG, {
        fullName: 'رفته',
        isActive: false,
      });
      expect(
        await service.linkChatToPersonnel(ORG, inactive.id, 'bale', 'c', 'ws'),
      ).toBeNull();

      const mine = await service.create(ORG, { fullName: 'مالِ ما' });
      expect(
        await service.linkChatToPersonnel('org-2', mine.id, 'bale', 'c', 'ws'),
      ).toBeNull();
    });

    it('مقصدها یک سطر به‌ازای هر اتصال می‌دهند، نه هر نفر', async () => {
      const two = await service.create(ORG, { fullName: 'دوسکویی' });
      const one = await service.create(ORG, { fullName: 'یک‌سکویی' });
      await service.create(ORG, { fullName: 'بی‌ربات' });
      await service.linkChatToPersonnel(ORG, two.id, 'bale', 'c1', 'ws');
      await service.linkChatToPersonnel(ORG, two.id, 'telegram', 'c2', 'ws');
      await service.linkChatToPersonnel(ORG, one.id, 'bale', 'c3', 'ws');

      const targets = await service.linkedTargets(ORG);
      // سه اتصال برای دو نفر؛ «بی‌ربات» نمی‌آید.
      expect(targets.length).toBe(3);
      expect(targets.filter((t) => t.personnelId === two.id).length).toBe(2);
      expect(targets.every((t) => t.fullName !== 'بی‌ربات')).toBe(true);
    });

    it('مقصدهای سازمانِ دیگر نمی‌آیند', async () => {
      const mine = await service.create(ORG, { fullName: 'مالِ ما' });
      const other = await service.create('org-2', { fullName: 'غریبه' });
      await service.linkChatToPersonnel(ORG, mine.id, 'bale', 'c1', 'ws');
      await service.linkChatToPersonnel('org-2', other.id, 'bale', 'c2', 'ws');

      expect((await service.linkedTargets(ORG)).length).toBe(1);
      expect((await service.linkedTargets('org-2')).length).toBe(1);
    });

    it('اتصالِ موبایلی هم روی همان جدول می‌نشیند', async () => {
      await service.create(ORG, {
        fullName: 'موبایلی',
        mobile: '09120000001',
      });
      const linked = await service.linkBotChat(
        ORG,
        '09120000001',
        'chat-m',
        'bale',
        'ws',
      );
      expect(linked?.fullName).toBe('موبایلی');
      expect((await service.findByChat('chat-m', 'bale'))?.id).toBe(linked?.id);

      const { unlinked } = await service.unlinkBotChat('chat-m', 'bale');
      expect(unlinked).toBe(true);
      expect(await service.findByChat('chat-m', 'bale')).toBeNull();
    });
  });
});
