import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Not, Repository } from 'typeorm';
import {
  AttendanceRecordEntity,
  AttendanceSource,
  AttendanceStatus,
  ShiftAssignmentEntity,
  ShiftTemplateEntity,
} from '../database/entities/work-shift.entity';
import {
  LeaveRequestEntity,
  LeaveStatus,
} from '../database/entities/leave-request.entity';
import {
  EmploymentStatus,
  PersonnelEntity,
} from '../database/entities/personnel.entity';
import { AuditService } from '../common/audit.service';
import {
  AttendanceLocationService,
  type PunchCoords,
} from './attendance-location.service';
import type { PunchLocation } from '../database/entities/work-shift.entity';

/** «HH:MM» معتبر است؟ */
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** امروز به‌شکلِ YYYY-MM-DD (UTC، مثلِ بقیهٔ ستون‌های تاریخ). */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** `days` روز بعد از یک تاریخِ ISO. */
export function shiftDate(iso: string, days: number): string {
  const base = Date.parse(`${iso}T00:00:00Z`);
  if (!Number.isFinite(base)) return iso;
  return new Date(base + days * 86400000).toISOString().slice(0, 10);
}

/** «HH:MM» به دقیقه از نیمه‌شب. */
export function minutesOf(time: string): number {
  const m = TIME_RE.exec(time);
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * طولِ شیفت بر حسبِ دقیقه، با پشتیبانیِ شیفتِ شب.
 *
 * پایانِ کوچک‌تر از شروع یعنی شیفت از نیمه‌شب می‌گذرد (۲۳:۰۰ تا ۰۷:۰۰)؛
 * بدونِ این، شیفتِ شب طولِ منفی می‌گرفت و گزارشِ کارکرد خراب می‌شد.
 */
export function shiftMinutes(startTime: string, endTime: string): number {
  const start = minutesOf(startTime);
  const end = minutesOf(endTime);
  return end > start ? end - start : 24 * 60 - start + end;
}

export interface TemplateInput {
  name?: string;
  startTime?: string;
  endTime?: string;
  departmentId?: string | null;
  color?: string;
  isActive?: boolean;
}

export interface AssignInput {
  personnelId: string;
  date: string;
  /** یا الگو بده، یا ساعتِ دستی. */
  templateId?: string | null;
  startTime?: string;
  endTime?: string;
  label?: string;
  note?: string;
}

export interface AttendanceInput {
  personnelId: string;
  date: string;
  status?: AttendanceStatus;
  checkIn?: string;
  checkOut?: string;
  note?: string;
  source?: AttendanceSource;
  /** محلِ ثبتِ ورود/خروج؛ فقط مسیرِ ربات پر می‌کند. */
  inLocation?: PunchLocation | null;
  outLocation?: PunchLocation | null;
}

/** یک ردیفِ «امروز چه کسی کار می‌کند». */
export interface DayBoardRow {
  personnelId: string;
  fullName: string;
  position: string;
  departmentId: string | null;
  shifts: Array<{
    id: string;
    label: string;
    startTime: string;
    endTime: string;
    note: string;
  }>;
  attendance: {
    status: AttendanceStatus;
    checkIn: string;
    checkOut: string;
    minutesWorked: number;
    note: string;
  } | null;
  /** مرخصیِ تأییدشده‌ی همان روز، اگر باشد. */
  onLeave: boolean;
}

/**
 * برنامهٔ کار و حضورِ پرسنل.
 *
 * شیفت و حضور یک سرویس‌اند چون عملاً یک سوال‌اند: «امروز قرار بود چه کسی
 * کار کند، و واقعاً چه شد؟» جدا کردنشان یعنی هر نمای مدیریتی باید دو
 * سرویس را خودش به هم بچسباند.
 *
 * دربارهٔ دستگاهِ کارت‌زن هیچ ادعایی نمی‌شود: ثبتِ حضور دستی (پنل) یا از
 * خودِ پرسنل (ربات) است و `source` همین را صریح نگه می‌دارد.
 */
@Injectable()
export class ShiftService {
  constructor(
    @InjectRepository(ShiftTemplateEntity)
    private readonly templates: Repository<ShiftTemplateEntity>,
    @InjectRepository(ShiftAssignmentEntity)
    private readonly assignments: Repository<ShiftAssignmentEntity>,
    @InjectRepository(AttendanceRecordEntity)
    private readonly attendance: Repository<AttendanceRecordEntity>,
    @InjectRepository(PersonnelEntity)
    private readonly people: Repository<PersonnelEntity>,
    @InjectRepository(LeaveRequestEntity)
    private readonly leaves: Repository<LeaveRequestEntity>,
    @Optional() private readonly audit?: AuditService,
    /* برای سازمانی که مکانِ مجاز تعریف نکرده، تزریقِ اختیاری رفتارِ پیشین را
     * حفظ می‌کند و تست‌های موجود ShiftService را بدونِ بازنویسی زنده می‌گذارد. */
    @Optional() private readonly places?: AttendanceLocationService,
  ) {}

  // ── الگوی شیفت ────────────────────────────────────────────────────────

  listTemplates(organizationId: string) {
    return this.templates.find({
      where: { organizationId },
      order: { startTime: 'ASC' },
    });
  }

  async createTemplate(
    organizationId: string,
    input: TemplateInput,
    actorId?: string,
  ) {
    const name = (input.name ?? '').trim();
    if (!name) throw new BadRequestException('نامِ شیفت لازم است');
    this.assertTime(input.startTime);
    this.assertTime(input.endTime);
    if (input.startTime === input.endTime) {
      throw new BadRequestException('شروع و پایانِ شیفت یکی است');
    }

    const saved = await this.templates.save(
      this.templates.create({
        ...input,
        name,
        organizationId,
      } as Partial<ShiftTemplateEntity>),
    );
    this.log(actorId, organizationId, 'shift.template.create', saved.id, {
      name,
    });
    return saved;
  }

  async updateTemplate(
    organizationId: string,
    id: string,
    input: TemplateInput,
    actorId?: string,
  ) {
    const row = await this.templates.findOne({ where: { id, organizationId } });
    if (!row) throw new NotFoundException('الگوی شیفت یافت نشد');
    if (input.startTime !== undefined) this.assertTime(input.startTime);
    if (input.endTime !== undefined) this.assertTime(input.endTime);

    const { organizationId: _o, id: _i, ...patch } = input as Record<
      string,
      never
    >;
    Object.assign(row, patch);
    const saved = await this.templates.save(row);
    this.log(actorId, organizationId, 'shift.template.update', id, {});
    return saved;
  }

  // ── تخصیصِ شیفت ───────────────────────────────────────────────────────

  /**
   * شیفت دادن به یک پرسنل در یک روز.
   *
   * ساعت از الگو کپی می‌شود (نه ارجاع)، و شیفتِ هم‌پوشان رد می‌شود تا یک
   * نفر در یک ساعت دو جا نباشد.
   */
  async assign(organizationId: string, input: AssignInput, actorId?: string) {
    const date = this.assertDate(input.date);
    const person = await this.assertPerson(organizationId, input.personnelId);

    let startTime = input.startTime ?? '';
    let endTime = input.endTime ?? '';
    let label = (input.label ?? '').trim();

    if (input.templateId) {
      const template = await this.templates.findOne({
        where: { id: input.templateId, organizationId },
      });
      if (!template) throw new NotFoundException('الگوی شیفت یافت نشد');
      startTime = template.startTime;
      endTime = template.endTime;
      if (!label) label = template.name;
    }
    this.assertTime(startTime);
    this.assertTime(endTime);

    // شیفتِ هم‌پوشان در همان روز.
    const sameDay = await this.assignments.find({
      where: { organizationId, personnelId: person.id, date },
    });
    const from = minutesOf(startTime);
    const to = from + shiftMinutes(startTime, endTime);
    for (const other of sameDay) {
      const oFrom = minutesOf(other.startTime);
      const oTo = oFrom + shiftMinutes(other.startTime, other.endTime);
      if (from < oTo && oFrom < to) {
        throw new BadRequestException(
          `این پرسنل در همان ساعت شیفتِ «${other.label || other.startTime}» دارد`,
        );
      }
    }

    const saved = await this.assignments.save(
      this.assignments.create({
        organizationId,
        personnelId: person.id,
        templateId: input.templateId ?? null,
        date,
        startTime,
        endTime,
        label,
        note: input.note ?? '',
      }),
    );
    this.log(actorId, organizationId, 'shift.assign', saved.id, {
      personnelId: person.id,
      date,
    });
    return saved;
  }

  async removeAssignment(organizationId: string, id: string, actorId?: string) {
    const row = await this.assignments.findOne({
      where: { id, organizationId },
    });
    if (!row) throw new NotFoundException('شیفت یافت نشد');
    await this.assignments.delete({ id });
    this.log(actorId, organizationId, 'shift.remove', id, {
      personnelId: row.personnelId,
      date: row.date,
    });
    return { ok: true };
  }

  /** برنامهٔ یک بازه، با نامِ پرسنل روی هر سطر. */
  async roster(
    organizationId: string,
    from: string,
    to: string,
    opts: { personnelId?: string; departmentId?: string } = {},
  ) {
    this.assertDate(from);
    this.assertDate(to);
    if (to < from) throw new BadRequestException('پایانِ بازه پیش از شروع است');

    const qb = this.assignments
      .createQueryBuilder('s')
      .where('s.organizationId = :org', { org: organizationId })
      .andWhere('s.date BETWEEN :from AND :to', { from, to })
      .orderBy('s.date', 'ASC')
      .addOrderBy('s.startTime', 'ASC');
    if (opts.personnelId) {
      qb.andWhere('s.personnelId = :p', { p: opts.personnelId });
    }
    const rows = await qb.getMany();

    const names = await this.namesOf(rows.map((r) => r.personnelId));
    const withNames = rows.map((r) => ({
      ...r,
      fullName: names.get(r.personnelId)?.fullName ?? 'نامشخص',
      departmentId: names.get(r.personnelId)?.departmentId ?? null,
    }));

    // محدودهٔ بخش بعد از خواندنِ نام اعمال می‌شود؛ بخش روی پروندهٔ پرسنل است.
    return opts.departmentId
      ? withNames.filter((r) => r.departmentId === opts.departmentId)
      : withNames;
  }

  /** آیا سازمان مکانِ مجازِ فعال دارد؟ ربات با این تصمیم می‌گیرد موقعیت بخواهد. */
  async hasGeofence(organizationId: string): Promise<boolean> {
    if (!this.places) return false;
    const places = await this.places.list(organizationId);
    return places.length > 0;
  }

  /** سطرِ حضورِ یک روزِ مشخص؛ null یعنی هنوز ثبت نشده. */
  attendanceOn(
    organizationId: string,
    personnelId: string,
    date = todayIso(),
  ) {
    return this.attendance.findOne({
      where: { organizationId, personnelId, date },
    });
  }

  /** شیفت‌های یک پرسنل در بازه — پاسخِ «شیفتِ من» در ربات. */
  myShifts(personnelId: string, from: string, to: string) {
    return this.assignments.find({
      where: { personnelId, date: Between(from, to) },
      order: { date: 'ASC', startTime: 'ASC' },
    });
  }

  // ── حضور ──────────────────────────────────────────────────────────────

  /**
   * ثبت یا اصلاحِ حضورِ یک روز.
   *
   * هر پرسنل در هر روز یک سطر دارد، پس ثبتِ دوباره همان سطر را اصلاح
   * می‌کند؛ وگرنه دو سطرِ متناقض برای یک روز می‌ماند.
   */
  async setAttendance(
    organizationId: string,
    input: AttendanceInput,
    actorId?: string,
  ) {
    const date = this.assertDate(input.date);
    const person = await this.assertPerson(organizationId, input.personnelId);
    if (input.checkIn) this.assertTime(input.checkIn);
    if (input.checkOut) this.assertTime(input.checkOut);

    const existing = await this.attendance.findOne({
      where: { organizationId, personnelId: person.id, date },
    });
    const row =
      existing ??
      this.attendance.create({
        organizationId,
        personnelId: person.id,
        date,
      });

    if (input.status !== undefined) row.status = input.status;
    if (input.checkIn !== undefined) row.checkIn = input.checkIn;
    if (input.checkOut !== undefined) row.checkOut = input.checkOut;
    if (input.note !== undefined) row.note = input.note;
    if (input.source !== undefined) row.source = input.source;
    if (input.inLocation !== undefined) row.inLocation = input.inLocation;
    if (input.outLocation !== undefined) row.outLocation = input.outLocation;
    row.byUserId = actorId ?? row.byUserId ?? null;

    /*
     * کارکرد از ورود و خروج حساب می‌شود، نه از طولِ شیفت.
     *
     * عددِ گزارش باید همان چیزی باشد که ثبت شده؛ اگر از شیفت می‌آمد،
     * غیبتِ نیمه‌روز هم «کارِ کامل» گزارش می‌شد.
     */
    row.minutesWorked =
      row.checkIn && row.checkOut ? shiftMinutes(row.checkIn, row.checkOut) : 0;

    const saved = await this.attendance.save(row);
    this.log(actorId, organizationId, 'attendance.set', saved.id, {
      personnelId: person.id,
      date,
      status: saved.status,
    });
    return saved;
  }

  /**
   * ثبتِ ورود/خروج از ربات، به‌دستِ خودِ پرسنل.
   *
   * «تأخیر» با مقایسه با شیفتِ همان روز مشخص می‌شود؛ بدونِ شیفت، ادعای
   * تأخیر بی‌معناست و حاضر ثبت می‌شود.
   */
  async botPunch(
    organizationId: string,
    personnelId: string,
    kind: 'in' | 'out',
    now = new Date(),
    coords?: PunchCoords | null,
  ) {
    const date = now.toISOString().slice(0, 10);
    const time = now.toISOString().slice(11, 16);
    const person = await this.assertPerson(organizationId, personnelId);

    /*
     * ژئوفنس فقط روی **ورود** اعمال می‌شود.
     *
     * الزامِ خروج از داخلِ محل، پرسنل را وقتی ساختمان را ترک کرده در
     * بن‌بست می‌گذارد؛ خروج با هر موقعیتی ثبت می‌شود و فقط مختصاتش برای
     * گزارش نگه داشته می‌شود. ورود اما همان لحظه‌ای است که ادعای «سرِ کار
     * هستم» باید با مکان بخواند.
     */
    if (kind === 'out') {
      const existing = await this.attendance.findOne({
        where: { organizationId, personnelId, date },
      });
      if (!existing?.checkIn) {
        throw new BadRequestException('ابتدا ورود را ثبت کنید');
      }
      const outLocation = await this.describePunch(
        organizationId,
        coords,
        person.departmentId,
      );
      return this.setAttendance(organizationId, {
        personnelId,
        date,
        checkOut: time,
        source: AttendanceSource.BOT,
        ...(outLocation ? { outLocation } : {}),
      });
    }

    const inLocation = await this.describePunch(
      organizationId,
      coords,
      person.departmentId,
    );
    if (inLocation?.status === 'outside') {
      const where = inLocation.locationName
        ? `نزدیک‌ترین مکانِ مجاز «${inLocation.locationName}» است و شما حدودِ ${inLocation.distanceMeters} متر از آن فاصله دارید.`
        : 'شما داخلِ محدودهٔ هیچ مکانِ مجازِ سازمان نیستید.';
      throw new BadRequestException(
        `ثبتِ ورود از این موقعیت ممکن نیست — ${where} اگر فکر می‌کنید خطاست، دوباره با GPS روشن تلاش کنید یا با منابع انسانی تماس بگیرید.`,
      );
    }

    const shifts = await this.assignments.find({
      where: { organizationId, personnelId, date },
      order: { startTime: 'ASC' },
    });
    // ۱۵ دقیقه ارفاق؛ بعد از آن تأخیر است.
    const late =
      shifts.length > 0 && minutesOf(time) > minutesOf(shifts[0].startTime) + 15;

    return this.setAttendance(organizationId, {
      personnelId,
      date,
      checkIn: time,
      status: late ? AttendanceStatus.LATE : AttendanceStatus.PRESENT,
      source: AttendanceSource.BOT,
      note: late ? `شیفت ${shifts[0].startTime}` : '',
      ...(inLocation ? { inLocation } : {}),
    });
  }

  /**
   * وضعیتِ حضورِ امروزِ یک پرسنل، برای تصمیمِ ربات بینِ «ورود» و «خروج».
   * اگر رکوردی نباشد `null` برمی‌گردد.
   */
  async todayStatus(organizationId: string, personnelId: string, now = new Date()) {
    const date = now.toISOString().slice(0, 10);
    const row = await this.attendance.findOne({
      where: { organizationId, personnelId, date },
    });
    if (!row) return null;
    return { checkIn: row.checkIn, checkOut: row.checkOut };
  }

  /** سنجشِ مختصات، فقط اگر سرویسِ مکان‌ها تزریق شده باشد. */
  private async describePunch(
    organizationId: string,
    coords: PunchCoords | null | undefined,
    departmentId: string | null,
  ): Promise<PunchLocation | null> {
    if (!coords || !this.places) return null;
    return this.places.describe(organizationId, coords, { departmentId });
  }

  // ── نمای روز ──────────────────────────────────────────────────────────

  /**
   * «امروز چه کسی کار می‌کند و چه شد؟»
   *
   * شیفت، حضور و مرخصیِ تأییدشده در یک جدول کنار هم می‌آیند؛ این همان
   * چیزی است که سرشیفت صبح لازم دارد و تا پیش از این باید از سه صفحه
   * جمع می‌شد.
   */
  async dayBoard(
    organizationId: string,
    date = todayIso(),
    opts: { departmentId?: string } = {},
  ): Promise<{ date: string; rows: DayBoardRow[]; totals: Record<string, number> }> {
    this.assertDate(date);

    /*
     * پرسنلِ «قطعِ همکاری» در تابلوی امروز نمی‌آید؛ پیش از این چون
     * `isActive`شان true بود، در ستونِ «حضورِ ثبت‌نشده» می‌نشستند و عددِ
     * واقعیِ شیفت را بالا می‌بردند.
     */
    const where: Record<string, unknown> = {
      organizationId,
      isActive: true,
      employmentStatus: Not(EmploymentStatus.TERMINATED),
    };
    if (opts.departmentId) where.departmentId = opts.departmentId;
    const people = await this.people.find({
      where,
      order: { fullName: 'ASC' },
    });
    const ids = people.map((p) => p.id);

    if (ids.length === 0) {
      return { date, rows: [], totals: this.emptyTotals() };
    }

    const [shifts, records, leaves] = await Promise.all([
      this.assignments.find({
        where: { organizationId, date, personnelId: In(ids) },
        order: { startTime: 'ASC' },
      }),
      this.attendance.find({
        where: { organizationId, date, personnelId: In(ids) },
      }),
      this.leaves
        .createQueryBuilder('l')
        .where('l.organizationId = :org', { org: organizationId })
        .andWhere('l.status = :s', { s: LeaveStatus.APPROVED })
        .andWhere('l.fromDate <= :d AND l.toDate >= :d', { d: date })
        .getMany(),
    ]);

    const shiftsBy = new Map<string, ShiftAssignmentEntity[]>();
    for (const s of shifts) {
      shiftsBy.set(s.personnelId, [...(shiftsBy.get(s.personnelId) ?? []), s]);
    }
    const recordBy = new Map(records.map((r) => [r.personnelId, r]));
    const onLeave = new Set(leaves.map((l) => l.personnelId));

    const rows: DayBoardRow[] = people.map((p) => {
      const record = recordBy.get(p.id) ?? null;
      return {
        personnelId: p.id,
        fullName: p.fullName,
        position: p.position,
        departmentId: p.departmentId,
        shifts: (shiftsBy.get(p.id) ?? []).map((s) => ({
          id: s.id,
          label: s.label,
          startTime: s.startTime,
          endTime: s.endTime,
          note: s.note,
        })),
        attendance: record
          ? {
              status: record.status,
              checkIn: record.checkIn,
              checkOut: record.checkOut,
              minutesWorked: record.minutesWorked,
              note: record.note,
            }
          : null,
        onLeave: onLeave.has(p.id),
      };
    });

    const totals = this.emptyTotals();
    totals.people = rows.length;
    for (const r of rows) {
      if (r.shifts.length > 0) totals.scheduled += 1;
      if (r.onLeave) totals.onLeave += 1;
      const status = r.attendance?.status;
      if (status === AttendanceStatus.PRESENT) totals.present += 1;
      if (status === AttendanceStatus.LATE) totals.late += 1;
      if (status === AttendanceStatus.ABSENT) totals.absent += 1;
      /*
       * «بی‌ثبت» یعنی شیفت داشته، مرخصی نبوده و حضورش ثبت نشده.
       *
       * همین عدد است که به سرشیفت می‌گوید کارِ ناتمامی دارد؛ بدونِ آن،
       * غیبتِ ثبت‌نشده با حاضر یکی دیده می‌شد.
       */
      if (r.shifts.length > 0 && !r.onLeave && !r.attendance) {
        totals.unrecorded += 1;
      }
    }

    return { date, rows, totals };
  }

  /** خلاصهٔ حضورِ یک بازه برای یک پرسنل (پروندهٔ شخصی). */
  async attendanceSummary(
    organizationId: string,
    personnelId: string,
    from: string,
    to: string,
  ) {
    this.assertDate(from);
    this.assertDate(to);
    const rows = await this.attendance.find({
      where: { organizationId, personnelId, date: Between(from, to) },
      order: { date: 'DESC' },
    });
    const byStatus: Record<string, number> = {};
    let minutes = 0;
    for (const r of rows) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
      minutes += r.minutesWorked;
    }
    return { from, to, rows, byStatus, minutesWorked: minutes };
  }

  private emptyTotals() {
    return {
      people: 0,
      scheduled: 0,
      present: 0,
      late: 0,
      absent: 0,
      onLeave: 0,
      unrecorded: 0,
    };
  }

  private async namesOf(ids: string[]) {
    const unique = [...new Set(ids)];
    const map = new Map<
      string,
      { fullName: string; departmentId: string | null }
    >();
    if (unique.length === 0) return map;
    const rows = await this.people.find({
      where: { id: In(unique) },
      select: { id: true, fullName: true, departmentId: true },
    });
    for (const r of rows) {
      map.set(r.id, { fullName: r.fullName, departmentId: r.departmentId });
    }
    return map;
  }

  private async assertPerson(organizationId: string, personnelId: string) {
    const person = await this.people.findOne({
      where: { id: personnelId, organizationId },
    });
    if (!person) throw new NotFoundException('پرسنل یافت نشد');
    return person;
  }

  private assertTime(time: string | undefined): string {
    if (!time || !TIME_RE.test(time)) {
      throw new BadRequestException('ساعت را به شکلِ ۰۸:۳۰ بدهید');
    }
    return time;
  }

  private assertDate(date: string | undefined): string {
    if (!date || !DATE_RE.test(date)) {
      throw new BadRequestException('تاریخ را به شکلِ ۲۰۲۶-۰۳-۲۱ بدهید');
    }
    return date;
  }

  private log(
    actorId: string | undefined,
    organizationId: string,
    action: string,
    entityId: string,
    meta: Record<string, unknown>,
  ) {
    void this.audit
      ?.log({
        organizationId,
        action,
        actorType: actorId ? 'user' : 'system',
        actorId: actorId ?? null,
        payload: { entityId, ...meta },
      })
      .catch(() => undefined);
  }
}
