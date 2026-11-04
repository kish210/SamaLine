import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';

import {
  PersonnelEntity,
  EmploymentStatus,
} from '../database/entities/personnel.entity';
import { DepartmentEntity } from '../database/entities/department.entity';
import {
  LeaveRequestEntity,
  LeaveStatus,
  LeaveType,
} from '../database/entities/leave-request.entity';
import { ShiftService } from './shift.service';

/**
 * میزِ کارِ مدیرِ منابع انسانی.
 *
 * پیش از این، مدیر باید چهار صفحه را برای یک تصویر باز می‌کرد: کارتابلِ
 * مرخصی، پرسنل، میزِ کارِ پرسنل و قراردادها. اینجا همان داده‌ها یک‌جا و
 * «قابلِ‌اقدام» می‌آیند: هر عدد یک صافیِ واقعی دارد که به فهرستِ مربوطه می‌رود.
 *
 * عمداً هیچ محاسبهٔ تازه‌ای اضافه نشده: شمارش‌ها از همان جدول‌هایی می‌آید که
 * صفحه‌های دیگر می‌خوانند، تا دو عددِ متفاوت در دو صفحه نبینیم.
 */

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: 'استحقاقی',
  sick: 'استعلاجی',
  unpaid: 'بی‌حقوق',
  mission: 'مأموریت',
  hourly: 'ساعتی',
  other: 'سایر',
};

export interface DeskLeave {
  id: string;
  number: string;
  personnelId: string;
  personnelName: string;
  departmentName: string;
  type: string;
  typeLabel: string;
  fromDate: string;
  toDate: string;
  days: number;
}

export interface DeskContract {
  id: string;
  fullName: string;
  position: string;
  departmentName: string;
  contractEndsAt: string;
  daysLeft: number;
}

@Injectable()
export class HrDeskService {
  constructor(
    @InjectRepository(PersonnelEntity)
    private readonly people: Repository<PersonnelEntity>,
    @InjectRepository(DepartmentEntity)
    private readonly departments: Repository<DepartmentEntity>,
    @InjectRepository(LeaveRequestEntity)
    private readonly leaves: Repository<LeaveRequestEntity>,
    private readonly shifts: ShiftService,
  ) {}

  /** تصویرِ امروزِ منابع انسانی برای یک سازمان. */
  async desk(organizationId: string, date?: string) {
    const day = date ?? new Date().toISOString().slice(0, 10);
    const soon = new Date(Date.now() + 30 * 86_400_000)
      .toISOString()
      .slice(0, 10);

    const board = await this.shifts.dayBoard(organizationId, day);

    const [departments, people, pending, expiring] = await Promise.all([
      this.departments.find({
        where: { organizationId },
        order: { name: 'ASC' },
      }),
      this.people.find({ where: { organizationId } }),
      this.leaves.find({
        where: { organizationId, status: LeaveStatus.PENDING },
        order: { createdAt: 'ASC' },
        take: 200,
      }),
      this.people
        .createQueryBuilder('p')
        .where('p.organizationId = :org', { org: organizationId })
        .andWhere('p.isActive = :a', { a: true })
        .andWhere("p.contractEndsAt <> ''")
        .andWhere('p.contractEndsAt <= :soon', { soon })
        .orderBy('p.contractEndsAt', 'ASC')
        .take(50)
        .getMany(),
    ]);

    const nameById = new Map(people.map((p) => [p.id, p.fullName]));
    const deptById = new Map(departments.map((d) => [d.id, d.name]));
    const deptOfPerson = new Map(people.map((p) => [p.id, p.departmentId]));

    const deskLeaves: DeskLeave[] = pending.map((l) => ({
      id: l.id,
      number: l.number,
      personnelId: l.personnelId,
      personnelName: nameById.get(l.personnelId) ?? '',
      departmentName: deptById.get(l.departmentId ?? '') ?? '',
      type: String(l.type),
      typeLabel: LEAVE_TYPE_LABELS[String(l.type)] ?? String(l.type),
      fromDate: l.fromDate,
      toDate: l.toDate,
      days: Number(l.days ?? 0),
    }));

    const deskContracts: DeskContract[] = expiring.map((p) => ({
      id: p.id,
      fullName: p.fullName,
      position: p.position ?? '',
      departmentName: deptById.get(p.departmentId ?? '') ?? '',
      contractEndsAt: p.contractEndsAt,
      daysLeft: Math.max(
        0,
        Math.round(
          (new Date(`${p.contractEndsAt}T00:00:00Z`).getTime() -
            new Date(`${day}T00:00:00Z`).getTime()) /
            86_400_000,
        ),
      ),
    }));

    // تفکیکِ واحدها: چند نفر، امروز چند نفر حضورشان ثبت نشده و چند نفر مرخصی‌اند.
    const unrecordedBy = new Map<string, number>();
    const onLeaveBy = new Map<string, number>();
    for (const row of board.rows) {
      const deptId = deptOfPerson.get(row.personnelId) ?? '';
      if (!row.attendance && !row.onLeave) {
        unrecordedBy.set(deptId, (unrecordedBy.get(deptId) ?? 0) + 1);
      }
      if (row.onLeave) {
        onLeaveBy.set(deptId, (onLeaveBy.get(deptId) ?? 0) + 1);
      }
    }
    const headBy = new Map<string, number>();
    for (const p of people) {
      if (!p.isActive) continue;
      // قطعِ همکاری در شمارشِ واحد هم حساب نمی‌شود، مثلِ `headcount`.
      if (p.employmentStatus === EmploymentStatus.TERMINATED) continue;
      const key = p.departmentId ?? '';
      headBy.set(key, (headBy.get(key) ?? 0) + 1);
    }

    const totals = board.totals as Record<string, number>;
    const headcount = people.filter(
      (p) =>
        p.isActive &&
        p.employmentStatus !== EmploymentStatus.TERMINATED,
    ).length;
    const terminated = people.filter(
      (p) => p.employmentStatus === EmploymentStatus.TERMINATED,
    ).length;

    return {
      date: day,
      generatedAt: new Date(),
      headcount,
      terminated,
      attendance: {
        scheduled: totals.scheduled ?? 0,
        present: totals.present ?? 0,
        late: totals.late ?? 0,
        absent: totals.absent ?? 0,
        onLeave: totals.onLeave ?? 0,
        unrecorded: totals.unrecorded ?? 0,
        people: totals.people ?? 0,
      },
      buckets: [
        {
          key: 'pendingLeaves',
          label: 'مرخصیِ منتظرِ تأیید',
          count: deskLeaves.length,
          href: '/leaves?bucket=pendingLeaves',
          tone: 'warn',
        },
        {
          key: 'unrecorded',
          label: 'حضورِ ثبت‌نشدهٔ امروز',
          count: totals.unrecorded ?? 0,
          href: '/workforce?filter=unrecorded',
          tone: 'danger',
        },
        {
          key: 'onLeaveToday',
          label: 'امروز در مرخصی',
          count: totals.onLeave ?? 0,
          href: '/workforce?filter=onLeave',
          tone: 'info',
        },
        {
          key: 'contractsExpiring',
          label: 'قراردادِ رو به پایان (۳۰ روز)',
          count: deskContracts.length,
          href: '/personnel',
          tone: 'danger',
        },
      ],
      pendingLeaves: deskLeaves.slice(0, 8),
      expiringContracts: deskContracts.slice(0, 8),
      departments: departments.map((d) => ({
        id: d.id,
        name: d.name,
        key: d.key,
        headcount: headBy.get(d.id) ?? 0,
        unrecorded: unrecordedBy.get(d.id) ?? 0,
        onLeave: onLeaveBy.get(d.id) ?? 0,
      })),
    };
  }

  /** شمارِ کلِ مرخصیِ معلق بدونِ سقفِ فهرست (برای نشانِ منو). */
  async pendingCount(organizationId: string) {
    const count = await this.leaves.count({
      where: { organizationId, status: LeaveStatus.PENDING },
    });
    return { count };
  }
}

export const __test__ = { LEAVE_TYPE_LABELS, LeaveType };
