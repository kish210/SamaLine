jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import type { DataSource } from 'typeorm';
import { createTestDataSource } from '../testing/test-database';
import { PersonnelEntity } from '../database/entities/personnel.entity';
import { PersonnelBotLinkEntity } from '../database/entities/personnel-bot-link.entity';
import { AssetEntity } from '../database/entities/asset.entity';
import {
  MaintenancePriority,
  MaintenanceRequestEntity,
} from '../database/entities/maintenance-request.entity';
import {
  WorkOrderEntity,
  WorkOrderStatus,
  WorkOrderTechnicianEntity,
} from '../database/entities/work-order.entity';
import { HotelRoomEntity } from '../database/entities/hotel-room.entity';
import {
  AttendanceRecordEntity,
  ShiftAssignmentEntity,
  ShiftTemplateEntity,
} from '../database/entities/work-shift.entity';
import {
  LeaveBalanceEntity,
  LeaveRequestEntity,
  LeaveStatus,
  LeaveType,
} from '../database/entities/leave-request.entity';
import {
  LetterEntity,
  LetterRecipientEntity,
} from '../database/entities/letter.entity';
import { HrService } from '../hr/hr.service';
import { LeaveService } from '../hr/leave.service';
import { ShiftService, shiftDate, todayIso } from '../hr/shift.service';
import { CmmsService } from '../cmms/cmms.service';
import { LetterService } from '../letters/letter.service';
import { DeskService } from './desk.service';

const ORG = 'org-1';
const USER = 'user-1';

describe('DeskService', () => {
  let ds: DataSource;
  let desk: DeskService;
  let hr: HrService;
  let cmms: CmmsService;
  let shifts: ShiftService;
  let leaves: LeaveService;
  let letters: LetterService;
  /** اطلاعیه‌هایی که استابِ سرویس برمی‌گرداند. */
  let news: Array<Record<string, unknown>>;
  let me: PersonnelEntity;

  const today = todayIso();

  beforeEach(async () => {
    ds = await createTestDataSource();
    news = [];

    hr = new HrService(
      ds.getRepository(PersonnelEntity),
      ds.getRepository(PersonnelBotLinkEntity),
    );
    cmms = new CmmsService(
      ds.getRepository(AssetEntity),
      ds.getRepository(MaintenanceRequestEntity),
      ds.getRepository(WorkOrderEntity),
      ds.getRepository(WorkOrderTechnicianEntity),
      ds.getRepository(PersonnelEntity),
      ds.getRepository(HotelRoomEntity),
      ds,
    );
    shifts = new ShiftService(
      ds.getRepository(ShiftTemplateEntity),
      ds.getRepository(ShiftAssignmentEntity),
      ds.getRepository(AttendanceRecordEntity),
      ds.getRepository(PersonnelEntity),
      ds.getRepository(LeaveRequestEntity),
    );
    leaves = new LeaveService(
      ds.getRepository(LeaveRequestEntity),
      ds.getRepository(LeaveBalanceEntity),
      ds.getRepository(PersonnelEntity),
    );
    letters = new LetterService(
      ds.getRepository(LetterEntity),
      ds.getRepository(LetterRecipientEntity),
      ds.getRepository(PersonnelEntity),
      ds,
    );
    desk = new DeskService(
      hr,
      cmms,
      shifts,
      leaves,
      letters,
      { list: async () => news } as never,
    );

    me = await hr.create(ORG, { fullName: 'زهرا', position: 'تکنسین' });
    await hr.setUserLink(ORG, me.id, USER);
  });

  afterEach(async () => {
    await ds.destroy();
  });

  it('حسابِ وصل‌نشده میزِ کارِ خالی نمی‌گیرد، دلیل می‌گیرد', async () => {
    const result = await desk.desk(ORG, 'user-without-personnel');
    expect(result.linked).toBe(false);
    // دلیلِ روشن، نه عددِ صفر که کاربر را گمراه کند.
    expect(result.linked === false && result.reason).toContain(
      'منابع انسانی',
    );
  });

  it('میزِ کارِ آرام، فهرستِ توجهِ خالی دارد', async () => {
    const result = await desk.desk(ORG, USER);
    expect(result.linked).toBe(true);
    if (!result.linked) throw new Error('unreachable');
    expect(result.attention).toHaveLength(0);
    expect(result.me.fullName).toBe('زهرا');
    expect(result.degraded).toHaveLength(0);
  });

  describe('کارهای من', () => {
    it('فقط کارهای سپرده‌شده به خودم می‌آید', async () => {
      await cmms.createWorkOrder(ORG, {
        title: 'کارِ من',
        technicianIds: [me.id],
      });
      const other = await hr.create(ORG, { fullName: 'دیگری' });
      await cmms.createWorkOrder(ORG, {
        title: 'کارِ دیگری',
        technicianIds: [other.id],
      });

      const result = await desk.desk(ORG, USER);
      if (!result.linked) throw new Error('unreachable');
      expect(result.tasks.open).toBe(1);
      expect(result.tasks.rows[0].title).toBe('کارِ من');
      expect(result.tasks.toStart).toBe(1);
    });

    it('کارِ اضطراری و عقب‌افتاده در صدرِ توجه می‌آیند', async () => {
      await cmms.createWorkOrder(ORG, {
        title: 'اضطراری',
        priority: MaintenancePriority.EMERGENCY,
        technicianIds: [me.id],
      });
      await cmms.createWorkOrder(ORG, {
        title: 'عقب‌افتاده',
        dueDate: shiftDate(today, -3),
        technicianIds: [me.id],
      });

      const result = await desk.desk(ORG, USER);
      if (!result.linked) throw new Error('unreachable');
      expect(result.tasks.overdue).toBe(1);
      expect(result.tasks.rows.some((t) => t.isOverdue)).toBe(true);

      const keys = result.attention.map((a) => a.key);
      expect(keys[0]).toBe('emergency');
      expect(keys).toContain('overdueTasks');
      expect(result.attention[0].tone).toBe('danger');
    });

    it('کارِ بسته‌شده دیگر در میزِ کار نیست', async () => {
      const wo = await cmms.createWorkOrder(ORG, {
        title: 'تمام‌شده',
        technicianIds: [me.id],
      });
      await cmms.changeWorkOrderStatus(ORG, wo.id, WorkOrderStatus.CANCELLED);

      const result = await desk.desk(ORG, USER);
      if (!result.linked) throw new Error('unreachable');
      expect(result.tasks.open).toBe(0);
    });

    it('کارِ در حالِ انجام جدا شمرده می‌شود', async () => {
      const wo = await cmms.createWorkOrder(ORG, {
        title: 'جاری',
        technicianIds: [me.id],
      });
      await cmms.changeWorkOrderStatus(ORG, wo.id, WorkOrderStatus.IN_PROGRESS);

      const result = await desk.desk(ORG, USER);
      if (!result.linked) throw new Error('unreachable');
      expect(result.tasks.inProgress).toBe(1);
      expect(result.tasks.toStart).toBe(0);
    });
  });

  describe('درخواست‌های من', () => {
    it('فقط درخواست‌هایی که خودم ثبت کرده‌ام می‌آید', async () => {
      await cmms.createRequest(ORG, {
        title: 'خرابیِ من',
        requestedByUserId: USER,
      });
      await cmms.createRequest(ORG, {
        title: 'خرابیِ دیگری',
        requestedByUserId: 'user-2',
      });
      // درخواستِ بی‌ثبت‌کننده هم نباید بیاید.
      await cmms.createRequest(ORG, { title: 'بی‌نام' });

      const result = await desk.desk(ORG, USER);
      if (!result.linked) throw new Error('unreachable');
      expect(result.requests.total).toBe(1);
      expect(result.requests.rows[0].title).toBe('خرابیِ من');
    });
  });

  describe('مرخصیِ من', () => {
    it('مرخصی و ماندهٔ من می‌آید و مرخصیِ دیگران نه', async () => {
      await leaves.create(ORG, {
        personnelId: me.id,
        type: LeaveType.ANNUAL,
        fromDate: shiftDate(today, 10),
        toDate: shiftDate(today, 11),
      });
      const other = await hr.create(ORG, { fullName: 'دیگری' });
      await leaves.create(ORG, {
        personnelId: other.id,
        type: LeaveType.ANNUAL,
        fromDate: shiftDate(today, 10),
        toDate: shiftDate(today, 11),
      });
      await leaves.setBalance(ORG, {
        personnelId: me.id,
        year: new Date().getUTCFullYear(),
        type: LeaveType.ANNUAL,
        entitledDays: 26,
      });

      const result = await desk.desk(ORG, USER);
      if (!result.linked) throw new Error('unreachable');
      expect(result.leaves.rows).toHaveLength(1);
      expect(result.leaves.pending).toBe(1);
      expect(result.leaves.balance.length).toBeGreaterThan(0);
    });
  });

  describe('شیفت و حضورِ من', () => {
    it('شیفتِ امروز و هفته جدا می‌آیند', async () => {
      await shifts.assign(ORG, {
        personnelId: me.id,
        date: today,
        startTime: '07:00',
        endTime: '15:00',
        label: 'صبح',
      });
      await shifts.assign(ORG, {
        personnelId: me.id,
        date: shiftDate(today, 2),
        startTime: '15:00',
        endTime: '23:00',
        label: 'عصر',
      });

      const result = await desk.desk(ORG, USER);
      if (!result.linked) throw new Error('unreachable');
      expect(result.shifts.today).toHaveLength(1);
      expect(result.shifts.today[0].label).toBe('صبح');
      expect(result.shifts.week).toHaveLength(2);
    });

    it('شیفتِ امروز بی‌حضورِ ثبت‌شده هشدار می‌دهد', async () => {
      await shifts.assign(ORG, {
        personnelId: me.id,
        date: today,
        startTime: '07:00',
        endTime: '15:00',
      });

      const result = await desk.desk(ORG, USER);
      if (!result.linked) throw new Error('unreachable');
      expect(result.attendance.today).toBeNull();
      expect(result.attention.map((a) => a.key)).toContain(
        'attendanceMissing',
      );
    });

    it('با ثبتِ حضور، هشدار می‌رود و کارکرد می‌آید', async () => {
      await shifts.assign(ORG, {
        personnelId: me.id,
        date: today,
        startTime: '07:00',
        endTime: '15:00',
      });
      await shifts.setAttendance(ORG, {
        personnelId: me.id,
        date: today,
        checkIn: '07:00',
        checkOut: '15:00',
      });

      const result = await desk.desk(ORG, USER);
      if (!result.linked) throw new Error('unreachable');
      expect(result.attendance.today?.minutesWorked).toBe(480);
      expect(result.attention.map((a) => a.key)).not.toContain(
        'attendanceMissing',
      );
      expect(result.attendance.month.minutesWorked).toBe(480);
    });

    it('بی‌شیفت، نبودِ حضور هشدار نیست', async () => {
      // بدونِ شیفت، ثبتِ حضور معنا ندارد و هشدار آزاردهنده می‌شد.
      const result = await desk.desk(ORG, USER);
      if (!result.linked) throw new Error('unreachable');
      expect(result.attention.map((a) => a.key)).not.toContain(
        'attendanceMissing',
      );
    });
  });

  describe('نامه‌ها', () => {
    it('شمارِ نخوانده و آخرین نامه‌ها می‌آید', async () => {
      const sender = await hr.create(ORG, { fullName: 'فرستنده' });
      await letters.send(ORG, sender.id, {
        subject: 'نامهٔ اول',
        to: [me.id],
      });

      const result = await desk.desk(ORG, USER);
      if (!result.linked) throw new Error('unreachable');
      expect(result.letters.unread).toBe(1);
      expect(result.letters.rows[0].subject).toBe('نامهٔ اول');
      expect(result.letters.rows[0].senderName).toBe('فرستنده');
      expect(result.attention.map((a) => a.key)).toContain('unreadLetters');
    });

    it('نامهٔ خوانده‌شده هشدار نمی‌دهد', async () => {
      const sender = await hr.create(ORG, { fullName: 'فرستنده' });
      const letter = await letters.send(ORG, sender.id, {
        subject: 'خوانده',
        to: [me.id],
      });
      await letters.markRead(ORG, letter.id, me.id);

      const result = await desk.desk(ORG, USER);
      if (!result.linked) throw new Error('unreachable');
      expect(result.letters.unread).toBe(0);
      expect(result.attention.map((a) => a.key)).not.toContain(
        'unreadLetters',
      );
    });
  });

  describe('اطلاعیه‌ها', () => {
    it('اطلاعیهٔ عمومی و بخشِ خودم می‌آید، بخشِ دیگران نه', async () => {
      await hr.update(ORG, me.id, { departmentId: 'dept-mine' });
      news = [
        {
          id: 'a1',
          title: 'عمومی',
          body: '',
          departmentId: null,
          createdAt: new Date(),
        },
        {
          id: 'a2',
          title: 'بخشِ من',
          body: '',
          departmentId: 'dept-mine',
          createdAt: new Date(),
        },
        {
          id: 'a3',
          title: 'بخشِ دیگران',
          body: '',
          departmentId: 'dept-other',
          createdAt: new Date(),
        },
      ];

      const result = await desk.desk(ORG, USER);
      if (!result.linked) throw new Error('unreachable');
      const titles = result.announcements.map((a) => a.title);
      expect(titles).toContain('عمومی');
      expect(titles).toContain('بخشِ من');
      // اطلاعیهٔ بخشِ دیگران نشتِ اطلاعات است.
      expect(titles).not.toContain('بخشِ دیگران');
    });
  });

  it('خطای یک بخش، کلِ میزِ کار را از کار نمی‌اندازد', async () => {
    const broken = new DeskService(
      hr,
      cmms,
      shifts,
      leaves,
      letters,
      { list: async () => Promise.reject(new Error('خراب')) } as never,
    );
    await cmms.createWorkOrder(ORG, {
      title: 'کارِ من',
      technicianIds: [me.id],
    });

    const result = await broken.desk(ORG, USER);
    if (!result.linked) throw new Error('unreachable');
    expect(result.degraded).toContain('announcements');
    // بقیهٔ بخش‌ها سرِ جایشان‌اند.
    expect(result.tasks.open).toBe(1);
  });

  it('هر سطرِ توجه مقصدِ قابلِ‌کلیک دارد', async () => {
    await cmms.createWorkOrder(ORG, {
      title: 'اضطراری',
      priority: MaintenancePriority.EMERGENCY,
      technicianIds: [me.id],
    });
    const result = await desk.desk(ORG, USER);
    if (!result.linked) throw new Error('unreachable');
    for (const item of result.attention) {
      expect(item.href.startsWith('/')).toBe(true);
    }
  });

  it('مرخصیِ تأییدشده دیگر «منتظرِ تأیید» نیست', async () => {
    const request = await leaves.create(ORG, {
      personnelId: me.id,
      type: LeaveType.ANNUAL,
      fromDate: shiftDate(today, 10),
      toDate: shiftDate(today, 11),
    });
    await leaves.decide(ORG, request.id, LeaveStatus.APPROVED);

    const result = await desk.desk(ORG, USER);
    if (!result.linked) throw new Error('unreachable');
    expect(result.leaves.pending).toBe(0);
    expect(result.leaves.rows).toHaveLength(1);
  });
});
