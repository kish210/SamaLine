import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';

import { DepartmentEntity } from '../database/entities/department.entity';
import { HotelRoomEntity } from '../database/entities/hotel-room.entity';
import { PersonnelEntity } from '../database/entities/personnel.entity';
import { MaintenanceRequestEntity } from '../database/entities/maintenance-request.entity';
import { WorkOrderEntity } from '../database/entities/work-order.entity';
import { CmmsService, ListQuery } from './cmms.service';

/*
 * خروجیِ اکسل از فهرست‌های عملیاتیِ CMMS (درخواست‌ها و دستورهای کار).
 *
 * برچسب‌ها اینجا (سمتِ سرور) نگه داشته می‌شوند چون پنل و رندرر اپِ جدا هستند و
 * نمی‌توانند ماژول مشترک import کنند؛ عبارت‌ها عمداً با نگاشتِ پنل یکی‌اند.
 * شناسه‌ها (بخش/اتاق/پرسنل) پیش از ساختِ شیت یک‌بار به نام تبدیل می‌شوند تا
 * اکسل برای مدیر خوانا باشد، نه پر از UUID.
 */

const STATUS_LABELS: Record<string, string> = {
  new: 'جدید',
  under_review: 'در حالِ بررسی',
  approved: 'تأییدشده',
  assigned: 'ارجاع‌شده',
  in_progress: 'در حالِ انجام',
  waiting_parts: 'منتظرِ قطعه',
  waiting_contractor: 'منتظرِ پیمانکار',
  follow_up: 'نیازمندِ پیگیری',
  completed: 'تکمیل‌شده',
  rejected: 'ردشده',
  closed: 'بسته',
  draft: 'بی‌متصدی',
  verified: 'تأییدِ مدیر',
  cancelled: 'لغوشده',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'کم',
  normal: 'عادی',
  high: 'زیاد',
  emergency: 'اضطراری',
};

const CATEGORY_LABELS: Record<string, string> = {
  electrical: 'برق',
  plumbing: 'لوله‌کشی',
  hvac: 'تهویه و تأسیسات',
  carpentry: 'نجاری',
  painting: 'نقاشی',
  furniture: 'مبلمان',
  network: 'شبکه / تلفن / تلویزیون',
  door_lock: 'قفل و کارت',
  other: 'سایر',
};

/** تاریخِ شمسی با ساعت، برای ستون‌های زمانی. */
function jalali(value: Date | string | null | undefined): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('fa-IR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Tehran',
  }).format(d);
}

/** تاریخِ کوتاهِ شمسی برای فیلدِ `dueDate` که فقط روز است (ISO «YYYY-MM-DD»). */
function jalaliDay(iso: string): string {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('fa-IR', {
    dateStyle: 'short',
    timeZone: 'Asia/Tehran',
  }).format(d);
}

/**
 * ستونِ خروجی.
 *
 * نوعِ ردیف عمومی است تا هر بخش، موجودیتِ خودش را بدونِ cast به ستون بدهد؛
 * پیش‌تر ستون `Record<string, unknown>` می‌خواست و موجودیت‌های TypeORM با آن
 * سازگار نبودند (خطای TS2345 در build).
 */
interface Column<T> {
  header: string;
  value: (row: T, lookups: Lookups) => string | number;
}

interface Lookups {
  departments: Map<string, string>;
  rooms: Map<string, string>;
  personnel: Map<string, string>;
}

@Injectable()
export class OperationalExportService {
  constructor(
    private readonly cmms: CmmsService,
    @InjectRepository(DepartmentEntity)
    private readonly departments: Repository<DepartmentEntity>,
    @InjectRepository(HotelRoomEntity)
    private readonly rooms: Repository<HotelRoomEntity>,
    @InjectRepository(PersonnelEntity)
    private readonly personnel: Repository<PersonnelEntity>,
  ) {}

  async requestsXlsx(
    organizationId: string,
    query: ListQuery,
  ): Promise<Buffer> {
    const rows = await this.cmms.allRequests(organizationId, query);
    const lookups = await this.buildLookups(organizationId);
    const columns: Column<MaintenanceRequestEntity>[] = [
      { header: 'شماره', value: (r) => String(r.number ?? '') },
      { header: 'عنوان', value: (r) => String(r.title ?? '') },
      {
        header: 'وضعیت',
        value: (r) => STATUS_LABELS[String(r.status)] ?? String(r.status ?? ''),
      },
      {
        header: 'اولویت',
        value: (r) =>
          PRIORITY_LABELS[String(r.priority)] ?? String(r.priority ?? ''),
      },
      {
        header: 'دسته',
        value: (r) =>
          CATEGORY_LABELS[String(r.category)] ?? String(r.category ?? ''),
      },
      {
        header: 'بخش',
        value: (r, l) => l.departments.get(String(r.departmentId ?? '')) ?? '',
      },
      {
        header: 'اتاق',
        value: (r, l) => l.rooms.get(String(r.roomId ?? '')) ?? '',
      },
      { header: 'محل', value: (r) => String(r.location ?? '') },
      {
        header: 'درخواست‌دهنده',
        value: (r, l) =>
          l.personnel.get(String(r.requestedByPersonnelId ?? '')) ?? '',
      },
      {
        header: 'مربوط به مهمان',
        value: (r) => (r.guestRelated ? 'بله' : 'خیر'),
      },
      { header: 'تأثیرِ عملیاتی', value: (r) => String(r.operationalImpact ?? '') },
      { header: 'موعد', value: (r) => jalaliDay(String(r.dueDate ?? '')) },
      { header: 'توضیحات', value: (r) => String(r.description ?? '') },
      {
        header: 'تاریخِ ثبت',
        value: (r) => jalali(r.createdAt as Date | null),
      },
      {
        header: 'تاریخِ تکمیل',
        value: (r) => jalali(r.completedAt as Date | null),
      },
    ];
    return this.workbook('درخواست‌ها', columns, rows, lookups);
  }

  async workOrdersXlsx(
    organizationId: string,
    query: ListQuery,
  ): Promise<Buffer> {
    const rows = await this.cmms.allWorkOrders(organizationId, query);
    const lookups = await this.buildLookups(organizationId);
    const columns: Column<WorkOrderEntity>[] = [
      { header: 'شماره', value: (r) => String(r.number ?? '') },
      { header: 'عنوان', value: (r) => String(r.title ?? '') },
      {
        header: 'وضعیت',
        value: (r) => STATUS_LABELS[String(r.status)] ?? String(r.status ?? ''),
      },
      {
        header: 'اولویت',
        value: (r) =>
          PRIORITY_LABELS[String(r.priority)] ?? String(r.priority ?? ''),
      },
      {
        header: 'دسته',
        value: (r) =>
          CATEGORY_LABELS[String(r.category)] ?? String(r.category ?? ''),
      },
      {
        header: 'بخش',
        value: (r, l) => l.departments.get(String(r.departmentId ?? '')) ?? '',
      },
      {
        header: 'اتاق',
        value: (r, l) => l.rooms.get(String(r.roomId ?? '')) ?? '',
      },
      { header: 'کارِ انجام‌شده', value: (r) => String(r.workPerformed ?? '') },
      { header: 'دقیقهٔ کار', value: (r) => Number(r.laborMinutes ?? 0) },
      {
        header: 'هزینهٔ داخلی (ریال)',
        value: (r) => Number(r.internalCost ?? 0),
      },
      {
        header: 'هزینهٔ پیمانکار (ریال)',
        value: (r) => Number(r.contractorCost ?? 0),
      },
      { header: 'موعد', value: (r) => jalaliDay(String(r.dueDate ?? '')) },
      {
        header: 'تاریخِ ثبت',
        value: (r) => jalali(r.createdAt as Date | null),
      },
      {
        header: 'شروعِ کار',
        value: (r) => jalali(r.startedAt as Date | null),
      },
      {
        header: 'تاریخِ تکمیل',
        value: (r) => jalali(r.completedAt as Date | null),
      },
    ];
    return this.workbook('دستورهای کار', columns, rows, lookups);
  }

  /** یک‌بار نامِ بخش/اتاق/پرسنل را برای کلِ سازمان می‌خوانَد (نه per-row). */
  private async buildLookups(organizationId: string): Promise<Lookups> {
    const [deps, rooms, people] = await Promise.all([
      this.departments.find({ where: { organizationId } }),
      this.rooms.find({ where: { organizationId } }),
      this.personnel.find({ where: { organizationId } }),
    ]);
    return {
      departments: new Map(deps.map((d) => [d.id, d.name])),
      rooms: new Map(
        // اتاق `name` ندارد؛ شماره + نوعِ اتاق برای مدیر خواناست.
        rooms.map((r) => [r.id, r.kind ? `${r.number} (${r.kind})` : r.number]),
      ),
      personnel: new Map(people.map((p) => [p.id, p.fullName])),
    };
  }

  private async workbook<T>(
    sheetName: string,
    columns: Column<T>[],
    rows: readonly T[],
    lookups: Lookups,
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SamaLine';
    const sheet = workbook.addWorksheet(sheetName, {
      views: [{ rightToLeft: true, state: 'frozen', ySplit: 1 }],
    });

    sheet.addRow(columns.map((c) => c.header));
    sheet.getRow(1).font = { bold: true };
    for (const row of rows) {
      sheet.addRow(columns.map((c) => c.value(row, lookups)));
    }

    sheet.columns.forEach((column, index) => {
      const headerLength = columns[index]?.header.length ?? 10;
      column.width = Math.min(44, Math.max(12, headerLength + 6));
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}

export const __test__ = {
  STATUS_LABELS,
  PRIORITY_LABELS,
  CATEGORY_LABELS,
  jalali,
  jalaliDay,
};
