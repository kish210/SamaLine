jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import type { DataSource } from 'typeorm';
import { createTestDataSource } from '../testing/test-database';
import { PersonnelEntity } from '../database/entities/personnel.entity';
import { PersonnelBotLinkEntity } from '../database/entities/personnel-bot-link.entity';
import {
  LetterEntity,
  LetterPriority,
  LetterRecipientEntity,
  LetterRecipientKind,
} from '../database/entities/letter.entity';
import { HrService } from '../hr/hr.service';
import { LetterService } from './letter.service';

const ORG = 'org-1';
const OTHER_ORG = 'org-2';

describe('LetterService', () => {
  let ds: DataSource;
  let letters: LetterService;
  let hr: HrService;
  /** سه همکارِ همیشگیِ آزمون‌ها. */
  let ali: string;
  let zahra: string;
  let maryam: string;

  const person = async (fullName: string, organizationId = ORG) =>
    (await hr.create(organizationId, { fullName })).id;

  beforeEach(async () => {
    ds = await createTestDataSource();
    hr = new HrService(
      ds.getRepository(PersonnelEntity),
      ds.getRepository(PersonnelBotLinkEntity),
    );
    letters = new LetterService(
      ds.getRepository(LetterEntity),
      ds.getRepository(LetterRecipientEntity),
      ds.getRepository(PersonnelEntity),
      ds,
    );
    ali = await person('علی');
    zahra = await person('زهرا');
    maryam = await person('مریم');
  });

  afterEach(async () => {
    await ds.destroy();
  });

  describe('ارسال', () => {
    it('نامه شمارهٔ خوانا می‌گیرد و در صندوقِ گیرنده می‌نشیند', async () => {
      const letter = await letters.send(ORG, ali, {
        subject: 'درخواستِ تعمیرِ آسانسور',
        body: 'آسانسورِ شمالی صدا می‌دهد.',
        to: [zahra],
      });

      expect(letter.number).toBe('L-00001');
      expect(letter.senderPersonnelId).toBe(ali);
      // نامهٔ اول سرِ رشته است، پس ریشه‌ی خودش است.
      expect(letter.threadId).toBe(letter.id);
      expect(letter.parentLetterId).toBeNull();

      const inbox = await letters.inbox(ORG, zahra, {});
      expect(inbox.total).toBe(1);
      expect(inbox.rows[0].subject).toBe('درخواستِ تعمیرِ آسانسور');
      expect(inbox.rows[0].senderName).toBe('علی');
      expect(inbox.rows[0].isUnread).toBe(true);
    });

    it('شماره در هر سازمان جدا پیش می‌رود', async () => {
      await letters.send(ORG, ali, { subject: 'یک', to: [zahra] });
      const second = await letters.send(ORG, ali, { subject: 'دو', to: [zahra] });
      expect(second.number).toBe('L-00002');

      const otherAli = await person('غریبه', OTHER_ORG);
      const otherZahra = await person('غریبه‌ی دوم', OTHER_ORG);
      const theirs = await letters.send(OTHER_ORG, otherAli, {
        subject: 'مالِ آن‌ها',
        to: [otherZahra],
      });
      expect(theirs.number).toBe('L-00001');
    });

    it('نامهٔ بی‌گیرنده رد می‌شود', async () => {
      await expect(
        letters.send(ORG, ali, { subject: 'بی‌گیرنده', to: [] }),
      ).rejects.toThrow('دست‌کم یک گیرنده');
      // و چیزی هم ثبت نمی‌شود.
      expect(await ds.getRepository(LetterEntity).count()).toBe(0);
    });

    it('موضوعِ خالی رد می‌شود', async () => {
      await expect(
        letters.send(ORG, ali, { subject: '   ', to: [zahra] }),
      ).rejects.toThrow('موضوعِ نامه لازم');
    });

    it('گیرندهٔ سازمانِ دیگر یا غیرفعال پذیرفته نمی‌شود', async () => {
      const stranger = await person('غریبه', OTHER_ORG);
      await expect(
        letters.send(ORG, ali, { subject: 'به غریبه', to: [stranger] }),
      ).rejects.toThrow('پرسنلِ فعالِ این سازمان');

      const gone = await hr.create(ORG, {
        fullName: 'رفته',
        isActive: false,
      });
      await expect(
        letters.send(ORG, ali, { subject: 'به رفته', to: [gone.id] }),
      ).rejects.toThrow('پرسنلِ فعالِ این سازمان');
    });

    it('گیرندهٔ تکراری یک‌بار حساب می‌شود و رونوشتِ تکراری حذف می‌شود', async () => {
      const letter = await letters.send(ORG, ali, {
        subject: 'تکراری',
        to: [zahra, zahra],
        // همان نفر هم در رونوشت: نباید دو سطر بسازد.
        cc: [zahra, maryam],
      });
      const rows = await ds
        .getRepository(LetterRecipientEntity)
        .find({ where: { letterId: letter.id } });
      expect(rows).toHaveLength(2);
      expect(
        rows.find((r) => r.personnelId === zahra)?.kind,
      ).toBe(LetterRecipientKind.TO);
      expect(rows.find((r) => r.personnelId === maryam)?.kind).toBe(
        LetterRecipientKind.CC,
      );
    });

    it('گیرندهٔ بیش از حد یعنی اطلاعیه، نه نامه', async () => {
      const many: string[] = [];
      for (let i = 0; i < 51; i += 1) many.push(await person(`نفر ${i}`));
      await expect(
        letters.send(ORG, ali, { subject: 'انبوه', to: many }),
      ).rejects.toThrow('اطلاعیه');
    });

    it('فوریت ثبت می‌شود', async () => {
      const letter = await letters.send(ORG, ali, {
        subject: 'فوری',
        to: [zahra],
        priority: LetterPriority.URGENT,
      });
      expect(letter.priority).toBe(LetterPriority.URGENT);
    });
  });

  describe('دیدنِ نامه', () => {
    it('فقط فرستنده و گیرنده‌ها نامه را می‌بینند', async () => {
      const letter = await letters.send(ORG, ali, {
        subject: 'خصوصی',
        to: [zahra],
      });

      // فرستنده و گیرنده: بله.
      await expect(letters.get(ORG, letter.id, ali)).resolves.toBeTruthy();
      await expect(letters.get(ORG, letter.id, zahra)).resolves.toBeTruthy();

      /*
       * هم‌سازمانِ بی‌ربط: نه.
       *
       * «یافت نشد» می‌گیرد نه «دسترسی ندارید»، تا وجودِ نامه هم لو نرود.
       */
      await expect(letters.get(ORG, letter.id, maryam)).rejects.toThrow(
        'یافت نشد',
      );
    });

    it('رونوشت‌گیرنده هم می‌بیند', async () => {
      const letter = await letters.send(ORG, ali, {
        subject: 'با رونوشت',
        to: [zahra],
        cc: [maryam],
      });
      await expect(letters.get(ORG, letter.id, maryam)).resolves.toBeTruthy();
      expect((await letters.inbox(ORG, maryam, {})).total).toBe(1);
    });

    it('نامهٔ سازمانِ دیگر دیده نمی‌شود', async () => {
      const letter = await letters.send(ORG, ali, {
        subject: 'مالِ ما',
        to: [zahra],
      });
      await expect(letters.get(OTHER_ORG, letter.id, ali)).rejects.toThrow(
        'یافت نشد',
      );
    });

    it('صندوقِ ارسال فقط نامه‌های خودم را می‌دهد', async () => {
      await letters.send(ORG, ali, { subject: 'از علی', to: [zahra] });
      await letters.send(ORG, zahra, { subject: 'از زهرا', to: [ali] });

      const mine = await letters.outbox(ORG, ali, {});
      expect(mine.total).toBe(1);
      expect(mine.rows[0].subject).toBe('از علی');
      expect(mine.rows[0].isMine).toBe(true);
    });

    it('جست‌وجو روی موضوع، شماره و متن کار می‌کند', async () => {
      await letters.send(ORG, ali, {
        subject: 'تعمیرِ آسانسور',
        body: 'طبقهٔ سوم',
        to: [zahra],
      });
      await letters.send(ORG, ali, { subject: 'سفارشِ ملحفه', to: [zahra] });

      expect((await letters.inbox(ORG, zahra, { search: 'آسانسور' })).total).toBe(1);
      expect((await letters.inbox(ORG, zahra, { search: 'طبقهٔ' })).total).toBe(1);
      expect((await letters.inbox(ORG, zahra, { search: 'L-00002' })).total).toBe(1);
      expect((await letters.inbox(ORG, zahra, {})).total).toBe(2);
    });
  });

  describe('خوانده‌شدن', () => {
    it('وضعیتِ خواندن به‌ازای هر گیرنده است', async () => {
      const letter = await letters.send(ORG, ali, {
        subject: 'دو گیرنده',
        to: [zahra, maryam],
      });

      await letters.markRead(ORG, letter.id, zahra);

      // زهرا خواند، مریم نه.
      expect((await letters.inbox(ORG, zahra, {})).rows[0].isUnread).toBe(false);
      expect((await letters.inbox(ORG, maryam, {})).rows[0].isUnread).toBe(true);
      expect(await letters.unreadCount(ORG, zahra)).toBe(0);
      expect(await letters.unreadCount(ORG, maryam)).toBe(1);
    });

    it('صافیِ نخوانده کار می‌کند', async () => {
      const first = await letters.send(ORG, ali, {
        subject: 'اول',
        to: [zahra],
      });
      await letters.send(ORG, ali, { subject: 'دوم', to: [zahra] });
      await letters.markRead(ORG, first.id, zahra);

      const unread = await letters.inbox(ORG, zahra, { unread: true });
      expect(unread.total).toBe(1);
      expect(unread.rows[0].subject).toBe('دوم');
    });

    it('خواندنِ دوباره زمانِ اول را عوض نمی‌کند', async () => {
      const letter = await letters.send(ORG, ali, {
        subject: 'یک‌بار',
        to: [zahra],
      });
      const first = await letters.markRead(ORG, letter.id, zahra);
      const second = await letters.markRead(ORG, letter.id, zahra);
      expect(second.readAt).toEqual(first.readAt);
    });

    it('فرستنده «خوانده» نمی‌شود ولی خطا هم نمی‌گیرد', async () => {
      const letter = await letters.send(ORG, ali, {
        subject: 'مالِ خودم',
        to: [zahra],
      });
      const result = await letters.markRead(ORG, letter.id, ali);
      expect(result.read).toBe(false);
    });

    it('بیگانه نمی‌تواند نامه را خوانده کند', async () => {
      const letter = await letters.send(ORG, ali, {
        subject: 'خصوصی',
        to: [zahra],
      });
      await expect(
        letters.markRead(ORG, letter.id, maryam),
      ).rejects.toThrow('برای شما نیست');
    });

    it('رسیدِ خواندنِ گیرنده‌ها به فرستنده نشان داده می‌شود', async () => {
      const letter = await letters.send(ORG, ali, {
        subject: 'رسید',
        to: [zahra, maryam],
      });
      await letters.markRead(ORG, letter.id, zahra);

      const mine = await letters.get(ORG, letter.id, ali);
      const byId = Object.fromEntries(
        mine.recipients.map((r) => [r.personnelId, r]),
      );
      expect(byId[zahra].readAt).toBeTruthy();
      expect(byId[maryam].readAt).toBeNull();
    });
  });

  describe('پاسخ و رشتهٔ مکاتبه', () => {
    it('پاسخ به فرستندهٔ اصلی می‌رود و بقیه رونوشت می‌گیرند', async () => {
      const first = await letters.send(ORG, ali, {
        subject: 'سوال',
        to: [zahra],
        cc: [maryam],
      });

      const answer = await letters.reply(ORG, zahra, first.id, {
        body: 'بله، انجام شد.',
      });

      expect(answer.subject).toBe('پاسخ: سوال');
      expect(answer.parentLetterId).toBe(first.id);
      // همان رشته می‌ماند، پس مکاتبه دو تکه نمی‌شود.
      expect(answer.threadId).toBe(first.threadId);

      const rows = await ds
        .getRepository(LetterRecipientEntity)
        .find({ where: { letterId: answer.id } });
      const byId = Object.fromEntries(rows.map((r) => [r.personnelId, r.kind]));
      expect(byId[ali]).toBe(LetterRecipientKind.TO);
      // مریم که در جریان بود، بیرون نمی‌افتد.
      expect(byId[maryam]).toBe(LetterRecipientKind.CC);
      // خودِ پاسخ‌دهنده گیرندهٔ نامهٔ خودش نیست.
      expect(byId[zahra]).toBeUndefined();
    });

    it('پاسخ دادن، نامهٔ اصلی را خوانده و پاسخ‌داده‌شده می‌کند', async () => {
      const first = await letters.send(ORG, ali, {
        subject: 'سوال',
        to: [zahra],
      });
      await letters.reply(ORG, zahra, first.id, { body: 'جواب' });

      const row = await ds.getRepository(LetterRecipientEntity).findOne({
        where: { letterId: first.id, personnelId: zahra },
      });
      expect(row?.readAt).toBeTruthy();
      expect(row?.repliedAt).toBeTruthy();
    });

    it('رشته همهٔ نامه‌ها را به ترتیبِ زمان می‌دهد', async () => {
      const first = await letters.send(ORG, ali, {
        subject: 'یک',
        to: [zahra],
      });
      const second = await letters.reply(ORG, zahra, first.id, { body: 'دو' });
      await letters.reply(ORG, ali, second.id, { body: 'سه' });

      const thread = await letters.thread(ORG, first.id, ali);
      expect(thread).toHaveLength(3);
      expect(thread.map((l) => l.number)).toEqual([
        'L-00001',
        'L-00002',
        'L-00003',
      ]);
      // از هر نامهٔ رشته هم همان رشته باز می‌شود.
      expect((await letters.thread(ORG, second.id, zahra)).length).toBe(3);
    });

    it('بیگانه نمی‌تواند با حدسِ شناسه به رشته بچسبد', async () => {
      const first = await letters.send(ORG, ali, {
        subject: 'خصوصی',
        to: [zahra],
      });
      await expect(
        letters.reply(ORG, maryam, first.id, { body: 'نفوذ' }),
      ).rejects.toThrow('یافت نشد');
      await expect(
        letters.send(ORG, maryam, {
          subject: 'نفوذ',
          to: [ali],
          parentLetterId: first.id,
        }),
      ).rejects.toThrow('یافت نشد');
    });

    it('کسی که از وسط اضافه شده، نامه‌های پیش از خودش را نمی‌بیند', async () => {
      const first = await letters.send(ORG, ali, {
        subject: 'یک',
        to: [zahra],
      });
      // مریم فقط در نامهٔ دوم اضافه می‌شود.
      await letters.send(ORG, zahra, {
        subject: 'دو',
        to: [ali],
        cc: [maryam],
        parentLetterId: first.id,
      });

      const seen = await letters.thread(ORG, first.id, maryam).catch(() => null);
      // از نامهٔ اول حتی رشته را هم نمی‌تواند باز کند.
      expect(seen).toBeNull();

      const fromSecond = await letters.inbox(ORG, maryam, {});
      expect(fromSecond.total).toBe(1);
      const thread = await letters.thread(
        ORG,
        fromSecond.rows[0].id,
        maryam,
      );
      // در رشته فقط همان نامه‌ای که گیرنده‌اش بوده دیده می‌شود.
      expect(thread.map((l) => l.subject)).toEqual(['دو']);
    });

    it('پاسخ به نامهٔ خودم (پیگیری) همان گیرنده‌ها را نگه می‌دارد', async () => {
      const first = await letters.send(ORG, ali, {
        subject: 'پیگیری',
        to: [zahra],
      });
      const follow = await letters.reply(ORG, ali, first.id, {
        body: 'یادآوری',
      });
      const rows = await ds
        .getRepository(LetterRecipientEntity)
        .find({ where: { letterId: follow.id } });
      expect(rows.map((r) => r.personnelId)).toEqual([zahra]);
    });

    it('موضوعِ دلخواهِ پاسخ پذیرفته می‌شود', async () => {
      const first = await letters.send(ORG, ali, {
        subject: 'یک',
        to: [zahra],
      });
      const answer = await letters.reply(ORG, zahra, first.id, {
        body: 'جواب',
        subject: 'موضوعِ تازه',
      });
      expect(answer.subject).toBe('موضوعِ تازه');
    });

    it('فوریتِ نامهٔ اصلی روی پاسخ می‌ماند', async () => {
      const first = await letters.send(ORG, ali, {
        subject: 'فوری',
        to: [zahra],
        priority: LetterPriority.URGENT,
      });
      const answer = await letters.reply(ORG, zahra, first.id, { body: 'باشد' });
      expect(answer.priority).toBe(LetterPriority.URGENT);
    });
  });

  it('هیچ مسیری برای حذفِ نامه وجود ندارد', () => {
    /*
     * نامه سندِ سازمانی است و پاک شدنش یعنی از بین رفتنِ تاریخچهٔ تصمیم.
     * این آزمون قراردادِ سرویس را قفل می‌کند: اگر روزی کسی متدِ حذف
     * اضافه کند، همین‌جا می‌شکند و باید آگاهانه تصمیم گرفته شود.
     */
    const api = Object.getOwnPropertyNames(
      Object.getPrototypeOf(letters),
    ).filter((name) => /delete|remove|destroy|purge/i.test(name));
    expect(api).toEqual([]);
  });
});
