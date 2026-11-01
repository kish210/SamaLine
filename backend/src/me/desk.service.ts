import { Injectable } from '@nestjs/common';
import { PersonnelEntity } from '../database/entities/personnel.entity';
import { WorkOrderStatus } from '../database/entities/work-order.entity';
import { MaintenancePriority } from '../database/entities/maintenance-request.entity';
import { LeaveStatus } from '../database/entities/leave-request.entity';
import { CmmsService } from '../cmms/cmms.service';
import { HrService } from '../hr/hr.service';
import { LeaveService } from '../hr/leave.service';
import { ShiftService, shiftDate, todayIso } from '../hr/shift.service';
import { LetterService } from '../letters/letter.service';
import { AnnouncementService } from '../integrations/announcement.service';

export type Tone = 'info' | 'warn' | 'danger';

/** یک سطرِ «این کارِ خودِ من است». */
export interface MyAttentionItem {
  key: string;
  text: string;
  count: number;
  tone: Tone;
  href: string;
}

/** سالِ شمسیِ جاری برای ماندهٔ مرخصی. */
function currentYear(): number {
  // ماندهٔ مرخصی بر مبنای سالِ میلادیِ ذخیره‌شده است؛ همان را می‌دهیم.
  return new Date().getUTCFullYear();
}

/**
 * میزِ کارِ شخصی.
 *
 * یک فراخوانی به جای شش: کارهای سپرده‌شده، درخواست‌های خودم، مرخصی و
 * مانده، شیفت و حضورِ خودم، نامه‌های نخوانده و اطلاعیه‌های بخشم.
 *
 * هیچ کوئریِ تازه‌ای تکرار نمی‌شود: همه از همان سرویس‌هایی می‌آید که
 * صفحه‌های اختصاصی استفاده می‌کنند، پس عددِ میزِ کار و عددِ صفحهٔ مقصد
 * نمی‌توانند از هم جدا بیفتند. هویت فقط از پروندهٔ پرسنلیِ متصل می‌آید.
 */
@Injectable()
export class DeskService {
  constructor(
    private readonly hr: HrService,
    private readonly cmms: CmmsService,
    private readonly shifts: ShiftService,
    private readonly leaves: LeaveService,
    private readonly letters: LetterService,
    private readonly announcements: AnnouncementService,
  ) {}

  async desk(organizationId: string, userId: string) {
    const person = await this.hr.findByUser(organizationId, userId);
    if (!person) {
      /*
       * حسابِ وصل‌نشده: میزِ کار خالی نمی‌ماند، صریح می‌گوید چرا.
       *
       * اگر فقط عددهای صفر برمی‌گشت، کاربر فکر می‌کرد کاری ندارد — در
       * حالی که مشکل این است که حسابش به پرونده وصل نیست.
       */
      return {
        linked: false as const,
        reason:
          'حسابِ شما به پروندهٔ پرسنلی وصل نیست؛ از واحدِ منابع انسانی بخواهید آن را وصل کند.',
        generatedAt: new Date(),
      };
    }

    const today = todayIso();
    const weekEnd = shiftDate(today, 6);
    const monthStart = shiftDate(today, -29);

    /*
     * هر بخش مستقل است و یکی‌شان نباید کلِ میزِ کار را از کار بیندازد؛
     * همان درسی که در میزِ فرماندهی گرفته شد.
     */
    const [
      tasks,
      myRequests,
      myLeaves,
      balance,
      myShifts,
      attendance,
      unread,
      inbox,
      news,
    ] = await Promise.allSettled([
      this.cmms.workOrdersOfTechnician(organizationId, person.id, {
        limit: 20,
      }),
      this.cmms.listRequests(organizationId, {
        requestedByUserId: userId,
        pageSize: 10,
      }),
      this.leaves.list(organizationId, {
        personnelId: person.id,
        pageSize: 10,
      }),
      this.leaves.balanceOf(organizationId, person.id, currentYear()),
      this.shifts.myShifts(person.id, today, weekEnd),
      this.shifts.attendanceSummary(
        organizationId,
        person.id,
        monthStart,
        today,
      ),
      this.letters.unreadCount(organizationId, person.id),
      this.letters.inbox(organizationId, person.id, { pageSize: 5 }),
      this.announcements.list(organizationId),
    ]);

    const ok = <T>(r: PromiseSettledResult<T>): T | null =>
      r.status === 'fulfilled' ? r.value : null;

    const taskRows = ok(tasks) ?? [];
    const requestRows = ok(myRequests)?.rows ?? [];
    const leaveRows = ok(myLeaves)?.rows ?? [];
    const shiftRows = ok(myShifts) ?? [];
    const attendanceData = ok(attendance);
    const unreadCount = ok(unread) ?? 0;
    const inboxRows = ok(inbox)?.rows ?? [];
    const newsRows = this.myNews(ok(news) ?? [], person);

    const todayShifts = shiftRows.filter((s) => s.date === today);
    const todayAttendance = (attendanceData?.rows ?? []).find(
      (r) => r.date === today,
    );
    const overdueTasks = taskRows.filter(
      (t) => t.dueDate && t.dueDate < today,
    );
    const toStart = taskRows.filter(
      (t) => t.status === WorkOrderStatus.ASSIGNED,
    );
    const inProgress = taskRows.filter(
      (t) => t.status === WorkOrderStatus.IN_PROGRESS,
    );
    const emergency = taskRows.filter(
      (t) => t.priority === MaintenancePriority.EMERGENCY,
    );
    const pendingLeaves = leaveRows.filter(
      (l) => l.status === LeaveStatus.PENDING,
    );

    return {
      linked: true as const,
      generatedAt: new Date(),
      date: today,
      me: {
        personnelId: person.id,
        fullName: person.fullName,
        position: person.position,
        departmentId: person.departmentId,
      },
      attention: this.attention({
        emergency: emergency.length,
        overdueTasks: overdueTasks.length,
        unreadLetters: unreadCount,
        toStart: toStart.length,
        /*
         * «حضورِ امروزم ثبت نشده» فقط وقتی هشدار است که شیفت داشته باشم.
         * بدونِ شیفت، ثبتِ حضور معنا ندارد و هشدار آزاردهنده می‌شد.
         */
        attendanceMissing:
          todayShifts.length > 0 && !todayAttendance ? 1 : 0,
      }),
      tasks: {
        open: taskRows.length,
        toStart: toStart.length,
        inProgress: inProgress.length,
        overdue: overdueTasks.length,
        rows: taskRows.slice(0, 10).map((t) => ({
          id: t.id,
          number: t.number,
          title: t.title,
          status: t.status,
          priority: t.priority,
          dueDate: t.dueDate,
          isOverdue: Boolean(t.dueDate && t.dueDate < today),
        })),
      },
      requests: {
        total: ok(myRequests)?.total ?? 0,
        rows: requestRows.map((r) => ({
          id: r.id,
          number: r.number,
          title: r.title,
          status: r.status,
          priority: r.priority,
          createdAt: r.createdAt,
        })),
      },
      leaves: {
        pending: pendingLeaves.length,
        rows: leaveRows.map((l) => ({
          id: l.id,
          number: l.number,
          type: l.type,
          status: l.status,
          fromDate: l.fromDate,
          toDate: l.toDate,
          days: l.days,
        })),
        balance: ok(balance) ?? [],
      },
      shifts: {
        today: todayShifts.map((s) => ({
          id: s.id,
          label: s.label,
          startTime: s.startTime,
          endTime: s.endTime,
          note: s.note,
        })),
        week: shiftRows.map((s) => ({
          id: s.id,
          date: s.date,
          label: s.label,
          startTime: s.startTime,
          endTime: s.endTime,
        })),
      },
      attendance: {
        today: todayAttendance
          ? {
              status: todayAttendance.status,
              checkIn: todayAttendance.checkIn,
              checkOut: todayAttendance.checkOut,
              minutesWorked: todayAttendance.minutesWorked,
            }
          : null,
        /** ۳۰ روزِ گذشته. */
        month: {
          from: attendanceData?.from ?? monthStart,
          to: attendanceData?.to ?? today,
          byStatus: attendanceData?.byStatus ?? {},
          minutesWorked: attendanceData?.minutesWorked ?? 0,
        },
      },
      letters: {
        unread: unreadCount,
        rows: inboxRows.map((l) => ({
          id: l.id,
          number: l.number,
          subject: l.subject,
          senderName: l.senderName,
          priority: l.priority,
          isUnread: l.isUnread,
          createdAt: l.createdAt,
        })),
      },
      announcements: newsRows,
      degraded: [
        tasks.status === 'rejected' ? 'tasks' : '',
        myRequests.status === 'rejected' ? 'requests' : '',
        myLeaves.status === 'rejected' ? 'leaves' : '',
        myShifts.status === 'rejected' ? 'shifts' : '',
        attendance.status === 'rejected' ? 'attendance' : '',
        unread.status === 'rejected' ? 'letters' : '',
        news.status === 'rejected' ? 'announcements' : '',
      ].filter(Boolean),
    };
  }

  /**
   * اطلاعیه‌های مربوط به خودم.
   *
   * اطلاعیهٔ عمومی (بی‌بخش) و اطلاعیهٔ بخشِ خودم؛ اطلاعیهٔ بخشِ دیگران
   * به من مربوط نیست و نشان دادنش هم نشتِ اطلاعات است.
   */
  private myNews(
    rows: Array<{
      id: string;
      title: string;
      body: string;
      departmentId: string | null;
      createdAt: Date;
    }>,
    person: PersonnelEntity,
  ) {
    return rows
      .filter(
        (a) => !a.departmentId || a.departmentId === person.departmentId,
      )
      .slice(0, 5)
      .map((a) => ({
        id: a.id,
        title: a.title,
        body: a.body,
        createdAt: a.createdAt,
      }));
  }

  /**
   * «این الان کارِ من است».
   *
   * فقط عددهای ناصفر، به ترتیبِ فوریت؛ فهرستِ خالی یعنی واقعاً چیزی روی
   * دوشم نیست.
   */
  private attention(counts: Record<string, number>): MyAttentionItem[] {
    const candidates: MyAttentionItem[] = [
      {
        key: 'emergency',
        count: counts.emergency,
        text: 'کارِ اضطراریِ سپرده‌شده به من',
        tone: 'danger',
        href: '/me#tasks',
      },
      {
        key: 'overdueTasks',
        count: counts.overdueTasks,
        text: 'کارِ من که موعدش گذشته',
        tone: 'danger',
        href: '/me#tasks',
      },
      {
        key: 'attendanceMissing',
        count: counts.attendanceMissing,
        text: 'امروز شیفت دارید و حضورتان ثبت نشده',
        tone: 'warn',
        href: '/me#attendance',
      },
      {
        key: 'unreadLetters',
        count: counts.unreadLetters,
        text: 'نامهٔ نخوانده',
        tone: 'warn',
        href: '/me#letters',
      },
      {
        key: 'toStart',
        count: counts.toStart,
        text: 'کارِ ارجاع‌شده که شروع نشده',
        tone: 'info',
        href: '/me#tasks',
      },
    ];
    const weight: Record<Tone, number> = { danger: 0, warn: 1, info: 2 };
    return candidates
      .filter((c) => c.count > 0)
      .sort((a, b) => weight[a.tone] - weight[b.tone] || b.count - a.count);
  }
}
