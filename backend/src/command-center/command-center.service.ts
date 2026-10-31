import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  HotelRoomEntity,
  RoomReadiness,
} from '../database/entities/hotel-room.entity';
import { CmmsService } from '../cmms/cmms.service';
import { InventoryService } from '../cmms/inventory.service';
import { ShiftService, todayIso } from '../hr/shift.service';
import { LeaveService } from '../hr/leave.service';

/** شدتِ یک کاشی؛ همان سه‌تایی که بقیهٔ پنل استفاده می‌کند. */
export type Tone = 'info' | 'warn' | 'danger';

/** یک عددِ قابلِ‌اقدام روی میزِ کار. */
export interface DeskTile {
  key: string;
  label: string;
  count: number;
  tone: Tone;
  /** کجا باید باز شود؛ همان مسیرِ پنل با صافیِ درست. */
  href: string;
}

export interface DeskSection {
  key: string;
  title: string;
  href: string;
  tiles: DeskTile[];
}

/** یک سطرِ «این الان توجه می‌خواهد». */
export interface AttentionItem {
  key: string;
  text: string;
  count: number;
  tone: Tone;
  href: string;
}

/**
 * میزِ فرماندهیِ مدیریت.
 *
 * داشبوردِ قبلی فقط گزارشِ نظرسنجی بود: مدیرِ هتل از آن نمی‌فهمید کارِ
 * اضطراری مانده، کسی سرِ شیفت نیامده، یا اتاقی از سرویس خارج است. اینجا
 * هر دامنه (فنی، نیرو، اتاق، انبار، بازخورد) عددِ قابلِ‌اقدامِ خودش را
 * می‌دهد و هر عدد `href` دارد تا به همان فهرستِ زیرین برود — عددِ تزئینی
 * نمی‌ماند.
 *
 * هیچ کوئریِ تازه‌ای تکرار نمی‌شود: همه از همان سرویس‌هایی می‌آید که
 * صفحه‌های اختصاصی استفاده می‌کنند، پس عددِ میزِ کار و عددِ صفحهٔ مقصد
 * هیچ‌وقت با هم اختلاف پیدا نمی‌کنند.
 */
@Injectable()
export class CommandCenterService {
  constructor(
    private readonly cmms: CmmsService,
    private readonly inventory: InventoryService,
    private readonly shifts: ShiftService,
    private readonly leaves: LeaveService,
    @InjectRepository(HotelRoomEntity)
    private readonly rooms: Repository<HotelRoomEntity>,
  ) {}

  async desk(organizationId: string, opts: { departmentId?: string } = {}) {
    const today = todayIso();

    /*
     * هر دامنه مستقل است و یکی‌شان نباید کلِ میزِ کار را از کار بیندازد.
     *
     * `allSettled` یعنی اگر مثلاً انبار خطا داد، بقیهٔ بخش‌ها همچنان نشان
     * داده می‌شوند و فقط همان بخش غایب می‌ماند — داشبوردی که با یک خطا
     * سفید می‌شود، همان «بی‌استفاده» بودنِ قبلی است.
     */
    const [ops, inv, day, leave, roomRows] = await Promise.allSettled([
      this.cmms.operationalSummary(organizationId, opts),
      this.inventory.summary(organizationId),
      this.shifts.dayBoard(organizationId, today, opts),
      this.leaves.summary(organizationId),
      this.rooms.find({
        where: { organizationId, isActive: true },
        select: { id: true, readiness: true },
      }),
    ]);

    const opsData = ops.status === 'fulfilled' ? ops.value : null;
    const invData = inv.status === 'fulfilled' ? inv.value : null;
    const dayData = day.status === 'fulfilled' ? day.value : null;
    const leaveData = leave.status === 'fulfilled' ? leave.value : null;
    const rooms = roomRows.status === 'fulfilled' ? roomRows.value : [];

    const opsBucket = (key: string) =>
      opsData?.buckets.find((b) => b.key === key)?.count ?? 0;
    const leaveBucket = (key: string) =>
      leaveData?.buckets.find((b) => b.key === key)?.count ?? 0;
    const roomsIn = (readiness: RoomReadiness) =>
      rooms.filter((r) => r.readiness === readiness).length;

    const sections: DeskSection[] = [];

    if (opsData) {
      sections.push({
        key: 'technical',
        title: 'عملیاتِ فنی',
        href: '/operations',
        tiles: [
          {
            key: 'emergency',
            label: 'کارِ اضطراری',
            count: opsBucket('emergency'),
            tone: 'danger',
            href: '/operations?bucket=emergency',
          },
          {
            key: 'overdue',
            label: 'کارِ عقب‌افتاده',
            count: opsBucket('overdue'),
            tone: 'danger',
            href: '/operations?bucket=overdue',
          },
          {
            key: 'newRequests',
            label: 'درخواستِ جدید',
            count: opsBucket('newRequests'),
            tone: 'info',
            href: '/operations?bucket=newRequests',
          },
          {
            key: 'awaitingWorkOrder',
            label: 'تأییدشده، بی‌دستورِکار',
            count: opsBucket('awaitingWorkOrder'),
            tone: 'warn',
            href: '/operations?bucket=awaitingWorkOrder',
          },
          {
            key: 'unassigned',
            label: 'بی‌متصدی',
            count: opsBucket('unassigned'),
            tone: 'warn',
            href: '/operations?bucket=unassigned',
          },
        ],
      });
    }

    if (dayData) {
      sections.push({
        key: 'workforce',
        title: 'نیرویِ امروز',
        href: '/workforce',
        tiles: [
          {
            key: 'unrecorded',
            label: 'حضورِ ثبت‌نشده',
            count: dayData.totals.unrecorded,
            tone: 'danger',
            href: '/workforce?filter=unrecorded',
          },
          {
            key: 'absent',
            label: 'غایب',
            count: dayData.totals.absent,
            tone: 'danger',
            href: '/workforce?filter=absent',
          },
          {
            key: 'late',
            label: 'تأخیر',
            count: dayData.totals.late,
            tone: 'warn',
            href: '/workforce?filter=late',
          },
          {
            key: 'present',
            label: 'حاضر',
            count: dayData.totals.present,
            tone: 'info',
            href: '/workforce?filter=present',
          },
          {
            key: 'scheduled',
            label: 'شیفتِ امروز',
            count: dayData.totals.scheduled,
            tone: 'info',
            href: '/workforce?filter=scheduled',
          },
          {
            key: 'pendingLeave',
            label: 'مرخصیِ منتظرِ تأیید',
            count: leaveBucket('pendingLeaves'),
            tone: 'warn',
            href: '/leaves',
          },
          {
            key: 'contractEnding',
            label: 'قراردادِ رو به پایان',
            count: leaveBucket('contractsExpiring'),
            tone: 'warn',
            href: '/personnel',
          },
        ],
      });
    }

    if (rooms.length > 0) {
      sections.push({
        key: 'rooms',
        title: 'آمادگیِ اتاق',
        href: '/rooms',
        tiles: [
          {
            key: 'outOfService',
            label: 'خارج از سرویس',
            count: roomsIn(RoomReadiness.OUT_OF_SERVICE),
            tone: 'danger',
            href: '/rooms',
          },
          {
            key: 'awaitingInspection',
            label: 'منتظرِ بازرسی',
            count: roomsIn(RoomReadiness.AWAITING_INSPECTION),
            tone: 'warn',
            href: '/rooms',
          },
          {
            key: 'underMaintenance',
            label: 'در تعمیر',
            count: roomsIn(RoomReadiness.UNDER_MAINTENANCE),
            tone: 'warn',
            href: '/rooms',
          },
          {
            key: 'ready',
            label: 'آماده',
            count: roomsIn(RoomReadiness.READY),
            tone: 'info',
            href: '/rooms',
          },
        ],
      });
    }

    if (invData) {
      sections.push({
        key: 'inventory',
        title: 'انبار',
        href: '/operations',
        tiles: invData.buckets.map((b) => ({
          key: b.key,
          label: b.label,
          count: b.count,
          tone: b.tone as Tone,
          href: '/operations?inventory=1',
        })),
      });
    }

    return {
      generatedAt: new Date(),
      date: today,
      sections,
      attention: this.attention({
        emergency: opsBucket('emergency'),
        overdue: opsBucket('overdue'),
        newRequests: opsBucket('newRequests'),
        awaitingWorkOrder: opsBucket('awaitingWorkOrder'),
        unrecorded: dayData?.totals.unrecorded ?? 0,
        absent: dayData?.totals.absent ?? 0,
        pendingLeave: leaveBucket('pendingLeaves'),
        contractEnding: leaveBucket('contractsExpiring'),
        lowStock:
          invData?.buckets.find((b) => b.key === 'lowStock')?.count ?? 0,
        roomsOut: roomsIn(RoomReadiness.OUT_OF_SERVICE),
        roomsAwaitingInspection: roomsIn(RoomReadiness.AWAITING_INSPECTION),
      }),
      cost: opsData?.cost ?? null,
      inventoryValue: invData?.valuation ?? null,
      headcount: leaveData?.headcount ?? dayData?.totals.people ?? 0,
      /** بخش‌هایی که خطا دادند؛ پنل می‌تواند صریح بگوید چه چیزی غایب است. */
      degraded: [
        ops.status === 'rejected' ? 'technical' : '',
        inv.status === 'rejected' ? 'inventory' : '',
        day.status === 'rejected' ? 'workforce' : '',
        leave.status === 'rejected' ? 'leave' : '',
        roomRows.status === 'rejected' ? 'rooms' : '',
      ].filter(Boolean),
    };
  }

  /**
   * «این الان توجه می‌خواهد».
   *
   * فقط عددهای ناصفر، به ترتیبِ فوریت. مدیر نباید برای فهمیدنِ اولویت،
   * پنج کاشی را با چشم مقایسه کند؛ همین فهرست جوابِ «از کجا شروع کنم؟»
   * است. صفرها حذف می‌شوند، پس فهرستِ خالی یعنی واقعاً چیزی معلق نیست.
   */
  private attention(counts: Record<string, number>): AttentionItem[] {
    const candidates: Array<Omit<AttentionItem, 'count'> & { count: number }> = [
      {
        key: 'emergency',
        count: counts.emergency,
        text: 'کارِ اضطراریِ باز',
        tone: 'danger',
        href: '/operations?bucket=emergency',
      },
      {
        key: 'roomsOut',
        count: counts.roomsOut,
        text: 'اتاقِ خارج از سرویس',
        tone: 'danger',
        href: '/rooms',
      },
      {
        key: 'overdue',
        count: counts.overdue,
        text: 'کارِ عقب‌افتاده',
        tone: 'danger',
        href: '/operations?bucket=overdue',
      },
      {
        key: 'unrecorded',
        count: counts.unrecorded,
        text: 'نفر با شیفتِ امروز که حضورش ثبت نشده',
        tone: 'danger',
        href: '/workforce?filter=unrecorded',
      },
      {
        key: 'absent',
        count: counts.absent,
        text: 'غایبِ امروز',
        tone: 'warn',
        href: '/workforce?filter=absent',
      },
      {
        key: 'awaitingWorkOrder',
        count: counts.awaitingWorkOrder,
        text: 'درخواستِ تأییدشده که دستورِ کار ندارد',
        tone: 'warn',
        href: '/operations?bucket=awaitingWorkOrder',
      },
      {
        key: 'pendingLeave',
        count: counts.pendingLeave,
        text: 'مرخصیِ منتظرِ تأیید',
        tone: 'warn',
        href: '/leaves',
      },
      {
        key: 'roomsAwaitingInspection',
        count: counts.roomsAwaitingInspection,
        text: 'اتاقِ منتظرِ بازرسی',
        tone: 'warn',
        href: '/rooms',
      },
      {
        key: 'lowStock',
        count: counts.lowStock,
        text: 'قطعهٔ زیرِ نقطهٔ سفارش',
        tone: 'warn',
        href: '/operations?inventory=1',
      },
      {
        key: 'newRequests',
        count: counts.newRequests,
        text: 'درخواستِ تعمیرِ بررسی‌نشده',
        tone: 'info',
        href: '/operations?bucket=newRequests',
      },
      {
        key: 'contractEnding',
        count: counts.contractEnding,
        text: 'قراردادِ رو به پایان',
        tone: 'info',
        href: '/personnel',
      },
    ];

    const weight: Record<Tone, number> = { danger: 0, warn: 1, info: 2 };
    return candidates
      .filter((c) => c.count > 0)
      .sort((a, b) => weight[a.tone] - weight[b.tone] || b.count - a.count);
  }
}
