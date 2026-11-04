import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';

import { PersonnelEntity } from '../database/entities/personnel.entity';
import { DepartmentEntity } from '../database/entities/department.entity';
import {
  LeaveRequestEntity,
  LeaveStatus,
  LeaveType,
} from '../database/entities/leave-request.entity';
import {
  AttendanceRecordEntity,
  AttendanceSource,
  AttendanceStatus,
} from '../database/entities/work-shift.entity';
import { isoToJalaliText } from '../common/jalali';

/**
 * خروجیِ اکسلِ دامنهٔ HR: پرسنل، مرخصی و حضوروغیاب.
 *
 * چرا در سرور ساخته می‌شود: پنل فقط ستون‌های همان صفحه را می‌بیند و برای
 * گزارشِ ماهانه باید همهٔ ردیف‌ها با برچسبِ فارسی و تاریخِ شمسی در یک فایل
 * باشند. برچسب‌ها با نگاشتِ پنل یکی‌اند تا فایل و صفحه یک چیز بگویند.
 */

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual: 'استحقاقی',
  sick: 'استعلاجی',
  unpaid: 'بی‌حقوق',
  mission: 'مأموریت',
  hourly: 'ساعتی',
  other: 'سایر',
};

const LEAVE_STATUS_LABELS: Record<string, string> = {
  pending: 'در انتظار',
  approved: 'تأییدشده',
  rejected: 'ردشده',
  cancelled: 'لغوشده',
};

const EMPLOYMENT_LABELS: Record<string, string> = {
  active: 'شاغل',
  on_leave: 'در مرخصی',
  suspended: 'تعلیق',
  terminated: 'قطعِ همکاری',
};

const CONTRACT_LABELS: Record<string, string> = {
  full_time: 'تمام‌وقت',
  part_time: 'پاره‌وقت',
  contract: 'پیمانی',
  temporary: 'موقت',
  probation: 'آزمایشی',
};

const ATTENDANCE_LABELS: Record<string, string> = {
  present: 'حاضر',
  late: 'تأخیر',
  absent: 'غایب',
  on_leave: 'مرخصی',
  off: 'تعطیل',
};

const SOURCE_LABELS: Record<string, string> = {
  manual: 'ثبتِ دستی',
  bot: 'ربات',
};

/** سقفِ ردیفِ خروجی؛ مثلِ خروجیِ عملیات، فایلِ بی‌مرز ساخته نمی‌شود. */
export const MAX_HR_EXPORT_ROWS = 20_000;

/** تبدیلِ ارقامِ لاتین به فارسی، تا فایل با بقیهٔ برچسب‌ها یک‌دست باشد. */
function toPersianDigits(text: string): string {
  return text.replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
}

/** تاریخِ شمسی از ISO؛ هر چیزِ نامعتبر خالی برمی‌گردد. */
function jalaliDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const text = String(iso).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return '';
  // `isoToJalaliText` ارقامِ لاتین می‌دهد (برای اکسل هم درست است)، ولی فایل
  // باید مثلِ بقیهٔ ستون‌ها فارسی باشد.
  return toPersianDigits(isoToJalaliText(text));
}

/** تاریخ و ساعتِ شمسی برای ستون‌های زمانی. */
function jalaliStamp(value: Date | string | null | undefined): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('fa-IR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Tehran',
  }).format(d);
}

interface Column<T> {
  header: string;
  width?: number;
  value: (row: T, ctx: Lookups) => string | number;
}

interface Lookups {
  departments: Map<string, string>;
  people: Map<string, string>;
}

@Injectable()
export class HrExportService {
  constructor(
    @InjectRepository(PersonnelEntity)
    private readonly people: Repository<PersonnelEntity>,
    @InjectRepository(DepartmentEntity)
    private readonly departments: Repository<DepartmentEntity>,
    @InjectRepository(LeaveRequestEntity)
    private readonly leaves: Repository<LeaveRequestEntity>,
    @InjectRepository(AttendanceRecordEntity)
    private readonly attendance: Repository<AttendanceRecordEntity>,
  ) {}

  /** پرسنل: داده‌ی پایه + وضعیتِ اشتغال و قرارداد. */
  async personnelXlsx(organizationId: string): Promise<Buffer> {
    const rows = await this.people.find({
      where: { organizationId },
      order: { fullName: 'ASC' },
      take: MAX_HR_EXPORT_ROWS,
    });
    const ctx = await this.buildLookups(organizationId);
    const columns: Column<PersonnelEntity>[] = [
      { header: 'کد پرسنلی', width: 16, value: (p) => p.employeeNo ?? '' },
      { header: 'نام', width: 28, value: (p) => p.fullName },
      { header: 'موبایل', width: 16, value: (p) => p.mobile ?? '' },
      { header: 'سمت', width: 24, value: (p) => p.position ?? '' },
      { header: 'بخش', width: 20, value: (p, l) => this.dep(p.departmentId, l) },
      { header: 'تاریخ استخدام', width: 14, value: (p) => jalaliDate(p.hireDate) },
      {
        header: 'وضعیت',
        width: 14,
        value: (p) => EMPLOYMENT_LABELS[String(p.employmentStatus)] ?? '',
      },
      {
        header: 'نوع قرارداد',
        width: 16,
        value: (p) => CONTRACT_LABELS[String(p.contractType ?? '')] ?? '',
      },
      {
        header: 'پایان قرارداد',
        width: 14,
        value: (p) => jalaliDate(p.contractEndsAt ?? ''),
      },
      { header: 'یادداشت', width: 40, value: (p) => p.notes ?? '' },
    ];
    return this.workbook('پرسنل', columns, rows, ctx);
  }

  /** درخواست‌های مرخصی با فیلترِ اختیاری (همان شکلِ فهرستِ پنل). */
  async leavesXlsx(
    organizationId: string,
    filter: { status?: string; type?: string; from?: string; to?: string } = {},
  ): Promise<Buffer> {
    const qb = this.leaves
      .createQueryBuilder('l')
      .where('l.organizationId = :org', { org: organizationId });
    if (filter.status) qb.andWhere('l.status = :s', { s: filter.status });
    if (filter.type) qb.andWhere('l.type = :t', { t: filter.type });
    if (filter.from) qb.andWhere('l.toDate >= :from', { from: filter.from });
    if (filter.to) qb.andWhere('l.fromDate <= :to', { to: filter.to });
    const rows = await qb
      .orderBy('l.fromDate', 'DESC')
      .take(MAX_HR_EXPORT_ROWS)
      .getMany();

    const ctx = await this.buildLookups(organizationId);
    const columns: Column<LeaveRequestEntity>[] = [
      { header: 'شماره', width: 14, value: (l) => l.number },
      {
        header: 'پرسنل',
        width: 28,
        value: (l, c) => c.people.get(l.personnelId) ?? '',
      },
      { header: 'بخش', width: 20, value: (l, c) => this.dep(l.departmentId, c) },
      {
        header: 'نوع',
        width: 14,
        value: (l) => LEAVE_TYPE_LABELS[String(l.type)] ?? String(l.type),
      },
      { header: 'از', width: 12, value: (l) => jalaliDate(l.fromDate) },
      { header: 'تا', width: 12, value: (l) => jalaliDate(l.toDate) },
      { header: 'روز', width: 8, value: (l) => Number(l.days ?? 0) },
      {
        header: 'وضعیت',
        width: 14,
        value: (l) => LEAVE_STATUS_LABELS[String(l.status)] ?? String(l.status),
      },
      { header: 'علت', width: 40, value: (l) => l.reason ?? '' },
      {
        header: 'زمانِ تصمیم',
        width: 20,
        value: (l) => jalaliStamp(l.decidedAt),
      },
      { header: 'یادداشتِ تصمیم', width: 32, value: (l) => l.decisionNote ?? '' },
    ];
    return this.workbook('مرخصی', columns, rows, ctx);
  }

  /**
   * حضوروغیاب در بازهٔ تاریخ (YYYY-MM-DD، میلادی).
   *
   * بازه اجباری است: بدونِ آن، خروجیِ کلِ تاریخچهٔ یک هتل ساخته می‌شود و
   * فایل بی‌فایده می‌شود.
   */
  async attendanceXlsx(
    organizationId: string,
    range: { from: string; to: string },
  ): Promise<Buffer> {
    const rows = await this.attendance.find({
      where: {
        organizationId,
        date: In(await this.datesInRange(range.from, range.to)),
      },
      order: { date: 'ASC' },
      take: MAX_HR_EXPORT_ROWS,
    });

    const ctx = await this.buildLookups(organizationId);
    const columns: Column<AttendanceRecordEntity>[] = [
      { header: 'تاریخ', width: 12, value: (a) => jalaliDate(a.date) },
      {
        header: 'پرسنل',
        width: 28,
        value: (a, c) => c.people.get(a.personnelId) ?? '',
      },
      {
        header: 'وضعیت',
        width: 12,
        value: (a) =>
          ATTENDANCE_LABELS[String(a.status)] ?? String(a.status ?? ''),
      },
      { header: 'ورود', width: 8, value: (a) => a.checkIn ?? '' },
      { header: 'خروج', width: 8, value: (a) => a.checkOut ?? '' },
      {
        header: 'کارکرد (دقیقه)',
        width: 14,
        value: (a) => Number(a.minutesWorked ?? 0),
      },
      {
        header: 'منبع',
        width: 14,
        value: (a) => SOURCE_LABELS[String(a.source)] ?? '',
      },
      { header: 'یادداشت', width: 36, value: (a) => a.note ?? '' },
    ];
    return this.workbook('حضوروغیاب', columns, rows, ctx);
  }

  /** همهٔ تاریخ‌های بازه؛ جدول روی `date` رشتهٔ ISO است، پس فهرست می‌سازیم. */
  private async datesInRange(from: string, to: string): Promise<string[]> {
    const start = new Date(`${from}T00:00:00Z`);
    const end = new Date(`${to}T00:00:00Z`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return [];
    }
    const days: string[] = [];
    const cursor = new Date(start);
    // سقفِ ۳۶۶ روز؛ بازهٔ بزرگ‌تر از یک سال در گزارشِ حضور معنا ندارد.
    for (let i = 0; i < 366 && cursor <= end; i += 1) {
      days.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return days;
  }

  private dep(id: string | null | undefined, lookups: Lookups): string {
    if (!id) return '';
    return lookups.departments.get(id) ?? '';
  }

  /** نامِ بخش و پرسنل یک‌بار خوانده می‌شوند، نه به تعدادِ ردیف. */
  private async buildLookups(organizationId: string): Promise<Lookups> {
    const [deps, people] = await Promise.all([
      this.departments.find({ where: { organizationId } }),
      this.people.find({ where: { organizationId } }),
    ]);
    return {
      departments: new Map(deps.map((d) => [d.id, d.name])),
      people: new Map(people.map((p) => [p.id, p.fullName])),
    };
  }

  private async workbook<T>(
    sheetName: string,
    columns: Column<T>[],
    rows: readonly T[],
    ctx: Lookups,
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SamaLine';
    const sheet = workbook.addWorksheet(sheetName, {
      views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }],
    });

    sheet.addRow(columns.map((c) => c.header));
    sheet.getRow(1).font = { bold: true };
    for (const row of rows) {
      sheet.addRow(columns.map((c) => c.value(row, ctx)));
    }
    sheet.columns.forEach((column, index) => {
      column.width = columns[index]?.width ?? 16;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}

export const __test__ = {
  LEAVE_TYPE_LABELS,
  LEAVE_STATUS_LABELS,
  EMPLOYMENT_LABELS,
  CONTRACT_LABELS,
  ATTENDANCE_LABELS,
  SOURCE_LABELS,
  jalaliDate,
  jalaliStamp,
  LeaveStatus,
  LeaveType,
  AttendanceStatus,
  AttendanceSource,
};
