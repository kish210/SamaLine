jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import type { DataSource } from 'typeorm';
import { createTestDataSource } from '../testing/test-database';
import { PersonnelEntity } from '../database/entities/personnel.entity';
import { PersonnelBotLinkEntity } from '../database/entities/personnel-bot-link.entity';
import {
  LeaveBalanceEntity,
  LeaveRequestEntity,
  LeaveStatus,
  LeaveType,
} from '../database/entities/leave-request.entity';
import {
  AttendanceRecordEntity,
  AttendanceSource,
  AttendanceStatus,
  ShiftAssignmentEntity,
  ShiftTemplateEntity,
} from '../database/entities/work-shift.entity';
import { HrService } from './hr.service';
import { LeaveService } from './leave.service';
import {
  ShiftService,
  minutesOf,
  shiftDate,
  shiftMinutes,
} from './shift.service';

const ORG = 'org-1';
const OTHER_ORG = 'org-2';

describe('کمک‌های زمانِ شیفت', () => {
  it('ساعت را به دقیقه تبدیل می‌کند', () => {
    expect(minutesOf('00:00')).toBe(0);
    expect(minutesOf('08:30')).toBe(510);
    expect(minutesOf('23:59')).toBe(1439);
    // ساعتِ نامعتبر صفر می‌شود، نه NaN؛ وگرنه محاسبه‌ها آلوده می‌شدند.
    expect(minutesOf('25:00')).toBe(0);
    expect(minutesOf('بد')).toBe(0);
  });

  it('شیفتِ شب طولِ درست دارد', () => {
    expect(shiftMinutes('07:00', '15:00')).toBe(480);
    // از نیمه‌شب می‌گذرد: ۸ ساعت، نه منفی.
    expect(shiftMinutes('23:00', '07:00')).toBe(480);
    expect(shiftMinutes('22:30', '06:30')).toBe(480);
  });

  it('تاریخ را درست جلو و عقب می‌برد', () => {
    expect(shiftDate('2026-03-21', 6)).toBe('2026-03-27');
    expect(shiftDate('2026-01-01', -1)).toBe('2025-12-31');
  });
});

describe('ShiftService', () => {
  let ds: DataSource;
  let shifts: ShiftService;
  let hr: HrService;
  let leave: LeaveService;

  /** پرسنلِ فعالِ تست. */
  const addPerson = (fullName: string, over: Record<string, unknown> = {}) =>
    hr.create(ORG, { fullName, ...over });

  const morning = () =>
    shifts.createTemplate(ORG, {
      name: 'صبح',
      startTime: '07:00',
      endTime: '15:00',
    });

  beforeEach(async () => {
    ds = await createTestDataSource();
    hr = new HrService(
      ds.getRepository(PersonnelEntity),
      ds.getRepository(PersonnelBotLinkEntity),
    );
    leave = new LeaveService(
      ds.getRepository(LeaveRequestEntity),
      ds.getRepository(LeaveBalanceEntity),
      ds.getRepository(PersonnelEntity),
    );
    shifts = new ShiftService(
      ds.getRepository(ShiftTemplateEntity),
      ds.getRepository(ShiftAssignmentEntity),
      ds.getRepository(AttendanceRecordEntity),
      ds.getRepository(PersonnelEntity),
      ds.getRepository(LeaveRequestEntity),
    );
  });

  afterEach(async () => {
    await ds.destroy();
  });

  describe('الگوی شیفت', () => {
    it('نام و ساعتِ معتبر لازم است', async () => {
      await expect(
        shifts.createTemplate(ORG, {
          name: ' ',
          startTime: '07:00',
          endTime: '15:00',
        }),
      ).rejects.toThrow('نامِ شیفت لازم');
      await expect(
        shifts.createTemplate(ORG, {
          name: 'بد',
          startTime: '7',
          endTime: '15:00',
        }),
      ).rejects.toThrow('۰۸:۳۰');
      await expect(
        shifts.createTemplate(ORG, {
          name: 'بد',
          startTime: '07:00',
          endTime: '07:00',
        }),
      ).rejects.toThrow('یکی است');
    });

    it('الگوی سازمانِ دیگر دیده نمی‌شود', async () => {
      await morning();
      expect((await shifts.listTemplates(ORG)).length).toBe(1);
      expect((await shifts.listTemplates(OTHER_ORG)).length).toBe(0);
    });
  });

  describe('تخصیصِ شیفت', () => {
    it('ساعت از الگو کپی می‌شود، نه ارجاع', async () => {
      const t = await morning();
      const person = await addPerson('زهرا');
      const a = await shifts.assign(ORG, {
        personnelId: person.id,
        date: '2026-03-21',
        templateId: t.id,
      });
      expect(a.startTime).toBe('07:00');
      expect(a.label).toBe('صبح');

      // ویرایشِ بعدیِ الگو نباید برنامهٔ اعلام‌شده را بازنویسی کند.
      await shifts.updateTemplate(ORG, t.id, { startTime: '09:00' });
      const after = await shifts.myShifts(
        person.id,
        '2026-03-21',
        '2026-03-21',
      );
      expect(after[0].startTime).toBe('07:00');
    });

    it('شیفتِ هم‌پوشان رد می‌شود ولی شیفتِ دوم در روز مجاز است', async () => {
      const person = await addPerson('علی');
      await shifts.assign(ORG, {
        personnelId: person.id,
        date: '2026-03-21',
        startTime: '07:00',
        endTime: '15:00',
        label: 'صبح',
      });

      // هم‌پوشان.
      await expect(
        shifts.assign(ORG, {
          personnelId: person.id,
          date: '2026-03-21',
          startTime: '14:00',
          endTime: '22:00',
        }),
      ).rejects.toThrow('همان ساعت');

      // شیفتِ شکسته‌ی بی‌هم‌پوشانی باید بشود.
      await expect(
        shifts.assign(ORG, {
          personnelId: person.id,
          date: '2026-03-21',
          startTime: '18:00',
          endTime: '22:00',
          label: 'عصر',
        }),
      ).resolves.toBeTruthy();
    });

    it('پرسنلِ سازمانِ دیگر شیفت نمی‌گیرد', async () => {
      const person = await addPerson('سمیرا');
      await expect(
        shifts.assign(OTHER_ORG, {
          personnelId: person.id,
          date: '2026-03-21',
          startTime: '07:00',
          endTime: '15:00',
        }),
      ).rejects.toThrow('یافت نشد');
    });

    it('تاریخِ بی‌قالب رد می‌شود', async () => {
      const person = await addPerson('مریم');
      await expect(
        shifts.assign(ORG, {
          personnelId: person.id,
          date: '۱۴۰۴/۰۱/۰۱',
          startTime: '07:00',
          endTime: '15:00',
        }),
      ).rejects.toThrow('۲۰۲۶-۰۳-۲۱');
    });

    it('برنامهٔ بازه با نامِ پرسنل برمی‌گردد و بازهٔ وارونه رد می‌شود', async () => {
      const a = await addPerson('اول');
      await shifts.assign(ORG, {
        personnelId: a.id,
        date: '2026-03-22',
        startTime: '07:00',
        endTime: '15:00',
      });
      // بیرونِ بازه.
      await shifts.assign(ORG, {
        personnelId: a.id,
        date: '2026-04-10',
        startTime: '07:00',
        endTime: '15:00',
      });

      const rows = await shifts.roster(ORG, '2026-03-21', '2026-03-27');
      expect(rows).toHaveLength(1);
      expect(rows[0].fullName).toBe('اول');

      await expect(
        shifts.roster(ORG, '2026-03-27', '2026-03-21'),
      ).rejects.toThrow('پیش از شروع');
    });

    it('حذفِ شیفت ممکن است', async () => {
      const person = await addPerson('حسن');
      const a = await shifts.assign(ORG, {
        personnelId: person.id,
        date: '2026-03-21',
        startTime: '07:00',
        endTime: '15:00',
      });
      await shifts.removeAssignment(ORG, a.id);
      expect(
        (await shifts.myShifts(person.id, '2026-03-21', '2026-03-21')).length,
      ).toBe(0);
      // دوباره حذف، خطای روشن می‌دهد.
      await expect(shifts.removeAssignment(ORG, a.id)).rejects.toThrow(
        'یافت نشد',
      );
    });
  });

  describe('حضور', () => {
    it('ثبتِ دوباره‌ی یک روز همان سطر را اصلاح می‌کند', async () => {
      const person = await addPerson('نسرین');
      await shifts.setAttendance(ORG, {
        personnelId: person.id,
        date: '2026-03-21',
        checkIn: '07:05',
      });
      const second = await shifts.setAttendance(ORG, {
        personnelId: person.id,
        date: '2026-03-21',
        checkOut: '15:10',
      });

      expect(second.checkIn).toBe('07:05');
      expect(second.checkOut).toBe('15:10');
      // یک سطر برای یک روز؛ وگرنه دو رکوردِ متناقض می‌ماند.
      expect(
        await ds.getRepository(AttendanceRecordEntity).count(),
      ).toBe(1);
    });

    it('کارکرد از ورود و خروج حساب می‌شود، نه از شیفت', async () => {
      const person = await addPerson('پیمان');
      await shifts.assign(ORG, {
        personnelId: person.id,
        date: '2026-03-21',
        startTime: '07:00',
        endTime: '15:00',
      });
      const rec = await shifts.setAttendance(ORG, {
        personnelId: person.id,
        date: '2026-03-21',
        checkIn: '07:00',
        // نیمه‌روز رفته؛ گزارش باید همین را بگوید.
        checkOut: '11:00',
      });
      expect(rec.minutesWorked).toBe(240);
    });

    it('بی‌خروج، کارکرد صفر می‌ماند', async () => {
      const person = await addPerson('شهلا');
      const rec = await shifts.setAttendance(ORG, {
        personnelId: person.id,
        date: '2026-03-21',
        checkIn: '07:00',
      });
      expect(rec.minutesWorked).toBe(0);
    });

    it('ساعتِ نامعتبر رد می‌شود', async () => {
      const person = await addPerson('کاظم');
      await expect(
        shifts.setAttendance(ORG, {
          personnelId: person.id,
          date: '2026-03-21',
          checkIn: '7:0',
        }),
      ).rejects.toThrow('۰۸:۳۰');
    });

    describe('ثبت از ربات', () => {
      const at = (iso: string) => new Date(iso);

      it('ورودِ سرِ وقت «حاضر» است', async () => {
        const person = await addPerson('بهرام');
        const date = new Date().toISOString().slice(0, 10);
        await shifts.assign(ORG, {
          personnelId: person.id,
          date,
          startTime: '07:00',
          endTime: '15:00',
        });

        const rec = await shifts.botPunch(
          ORG,
          person.id,
          'in',
          at(`${date}T07:10:00Z`),
        );
        expect(rec.status).toBe(AttendanceStatus.PRESENT);
        expect(rec.checkIn).toBe('07:10');
        expect(rec.source).toBe(AttendanceSource.BOT);
      });

      it('بیش از ۱۵ دقیقه دیرتر «تأخیر» است', async () => {
        const person = await addPerson('فرهاد');
        const date = new Date().toISOString().slice(0, 10);
        await shifts.assign(ORG, {
          personnelId: person.id,
          date,
          startTime: '07:00',
          endTime: '15:00',
        });

        const rec = await shifts.botPunch(
          ORG,
          person.id,
          'in',
          at(`${date}T07:40:00Z`),
        );
        expect(rec.status).toBe(AttendanceStatus.LATE);
      });

      it('بی‌شیفت، ادعای تأخیر نمی‌شود', async () => {
        const person = await addPerson('بی‌برنامه');
        const date = new Date().toISOString().slice(0, 10);
        const rec = await shifts.botPunch(
          ORG,
          person.id,
          'in',
          at(`${date}T11:00:00Z`),
        );
        expect(rec.status).toBe(AttendanceStatus.PRESENT);
      });

      it('خروجِ بی‌ورود رد می‌شود', async () => {
        const person = await addPerson('شتاب‌زده');
        await expect(
          shifts.botPunch(ORG, person.id, 'out'),
        ).rejects.toThrow('ابتدا ورود');
      });

      it('خروج پس از ورود، کارکرد را می‌بندد', async () => {
        const person = await addPerson('کامل');
        const date = new Date().toISOString().slice(0, 10);
        await shifts.botPunch(ORG, person.id, 'in', at(`${date}T07:00:00Z`));
        const out = await shifts.botPunch(
          ORG,
          person.id,
          'out',
          at(`${date}T15:00:00Z`),
        );
        expect(out.minutesWorked).toBe(480);
      });
    });

    it('خلاصهٔ بازه، وضعیت‌ها و کارکرد را جمع می‌زند', async () => {
      const person = await addPerson('جمع‌بندی');
      await shifts.setAttendance(ORG, {
        personnelId: person.id,
        date: '2026-03-21',
        checkIn: '07:00',
        checkOut: '15:00',
      });
      await shifts.setAttendance(ORG, {
        personnelId: person.id,
        date: '2026-03-22',
        status: AttendanceStatus.ABSENT,
      });

      const sum = await shifts.attendanceSummary(
        ORG,
        person.id,
        '2026-03-21',
        '2026-03-22',
      );
      expect(sum.minutesWorked).toBe(480);
      expect(sum.byStatus[AttendanceStatus.PRESENT]).toBe(1);
      expect(sum.byStatus[AttendanceStatus.ABSENT]).toBe(1);
    });
  });

  describe('نمای روز', () => {
    const DATE = '2026-03-21';

    it('شیفت، حضور و مرخصی را کنار هم می‌گذارد', async () => {
      const working = await addPerson('شیفت‌دار', { position: 'سرایدار' });
      const absent = await addPerson('بی‌ثبت');
      const resting = await addPerson('در مرخصی');

      await shifts.assign(ORG, {
        personnelId: working.id,
        date: DATE,
        startTime: '07:00',
        endTime: '15:00',
        label: 'صبح',
      });
      await shifts.setAttendance(ORG, {
        personnelId: working.id,
        date: DATE,
        checkIn: '07:02',
        checkOut: '15:05',
      });

      // شیفت دارد ولی حضورش ثبت نشده.
      await shifts.assign(ORG, {
        personnelId: absent.id,
        date: DATE,
        startTime: '15:00',
        endTime: '23:00',
        label: 'عصر',
      });

      // مرخصیِ تأییدشده.
      const req = await leave.create(ORG, {
        personnelId: resting.id,
        type: LeaveType.PAID,
        fromDate: DATE,
        toDate: DATE,
        reason: 'کارِ شخصی',
      });
      await leave.decide(ORG, req.id, LeaveStatus.APPROVED);

      const board = await shifts.dayBoard(ORG, DATE);
      const byId = Object.fromEntries(
        board.rows.map((r) => [r.personnelId, r]),
      );

      expect(board.date).toBe(DATE);
      expect(byId[working.id].shifts[0].label).toBe('صبح');
      expect(byId[working.id].attendance?.minutesWorked).toBe(483);
      expect(byId[working.id].position).toBe('سرایدار');

      expect(byId[absent.id].shifts).toHaveLength(1);
      expect(byId[absent.id].attendance).toBeNull();

      expect(byId[resting.id].onLeave).toBe(true);

      expect(board.totals.people).toBe(3);
      expect(board.totals.scheduled).toBe(2);
      expect(board.totals.present).toBe(1);
      expect(board.totals.onLeave).toBe(1);
      // «بی‌ثبت» فقط کسی است که شیفت داشت، مرخصی نبود و حضورش ثبت نشد.
      expect(board.totals.unrecorded).toBe(1);
    });

    it('مرخصیِ تأییدشده بی‌ثبت شمرده نمی‌شود', async () => {
      const person = await addPerson('مرخصیِ شیفت‌دار');
      await shifts.assign(ORG, {
        personnelId: person.id,
        date: DATE,
        startTime: '07:00',
        endTime: '15:00',
      });
      const req = await leave.create(ORG, {
        personnelId: person.id,
        type: LeaveType.PAID,
        fromDate: DATE,
        toDate: DATE,
      });
      await leave.decide(ORG, req.id, LeaveStatus.APPROVED);

      const board = await shifts.dayBoard(ORG, DATE);
      expect(board.totals.unrecorded).toBe(0);
      expect(board.totals.onLeave).toBe(1);
    });

    it('مرخصیِ منتظرِ تأیید در نمای روز مرخصی نیست', async () => {
      const person = await addPerson('منتظرِ تأیید');
      await leave.create(ORG, {
        personnelId: person.id,
        type: LeaveType.PAID,
        fromDate: DATE,
        toDate: DATE,
      });
      const board = await shifts.dayBoard(ORG, DATE);
      expect(board.rows[0].onLeave).toBe(false);
      expect(board.totals.onLeave).toBe(0);
    });

    it('پرسنلِ غیرفعال در نمای روز نمی‌آید', async () => {
      await addPerson('فعال');
      await addPerson('رفته', { isActive: false });
      const board = await shifts.dayBoard(ORG, DATE);
      expect(board.rows).toHaveLength(1);
      expect(board.rows[0].fullName).toBe('فعال');
    });

    it('سازمانِ بی‌پرسنل نمای خالیِ سالم می‌دهد', async () => {
      const board = await shifts.dayBoard(OTHER_ORG, DATE);
      expect(board.rows).toHaveLength(0);
      expect(board.totals.people).toBe(0);
    });

    it('پرسنلِ سازمانِ دیگر در نمای روز نمی‌آید', async () => {
      await addPerson('مالِ ما');
      await hr.create(OTHER_ORG, { fullName: 'مالِ غریبه' });
      const board = await shifts.dayBoard(ORG, DATE);
      expect(board.rows).toHaveLength(1);
      expect(board.rows[0].fullName).toBe('مالِ ما');
    });
  });
});
