import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  LeaveBalanceEntity,
  LeaveHistoryStep,
  LeaveRequestEntity,
  LeaveStatus,
  LeaveType,
} from '../database/entities/leave-request.entity';
import {
  EmploymentStatus,
  PersonnelEntity,
} from '../database/entities/personnel.entity';
import { AuditService } from '../common/audit.service';

/** گذارهای مجازِ وضعیتِ مرخصی. */
const TRANSITIONS: Record<LeaveStatus, LeaveStatus[]> = {
  [LeaveStatus.PENDING]: [
    LeaveStatus.APPROVED,
    LeaveStatus.REJECTED,
    LeaveStatus.CANCELLED,
  ],
  // مرخصیِ تأییدشده تا پیش از شروع قابلِ لغو است.
  [LeaveStatus.APPROVED]: [LeaveStatus.CANCELLED],
  [LeaveStatus.REJECTED]: [],
  [LeaveStatus.CANCELLED]: [],
};

export interface LeaveListQuery {
  status?: string;
  type?: string;
  personnelId?: string;
  departmentId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

const MAX_PAGE_SIZE = 200;

/** امروز به‌شکلِ YYYY-MM-DD. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * شمارشِ روزهای بین دو تاریخِ ISO (هر دو سر شامل).
 *
 * تعطیلاتِ رسمی کسر نمی‌شود: تقویمِ تعطیلاتِ هر مجموعه فرق دارد و حدس‌زدنش
 * عددِ نادرست می‌سازد. اگر لازم شد، بعداً از تنظیماتِ سازمان خوانده می‌شود.
 */
export function countDays(fromDate: string, toDate: string): number {
  const from = Date.parse(`${fromDate}T00:00:00Z`);
  const to = Date.parse(`${toDate}T00:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  if (to < from) return 0;
  return Math.round((to - from) / 86400000) + 1;
}

/**
 * مرخصی و ماندهٔ آن (دامنهٔ HR).
 *
 * `organizationId` همیشه از توکن می‌آید؛ هیچ پرس‌وجویی بدونِ قیدِ سازمان نیست.
 */
@Injectable()
export class LeaveService {
  constructor(
    @InjectRepository(LeaveRequestEntity)
    private readonly leaves: Repository<LeaveRequestEntity>,
    @InjectRepository(LeaveBalanceEntity)
    private readonly balances: Repository<LeaveBalanceEntity>,
    @InjectRepository(PersonnelEntity)
    private readonly personnel: Repository<PersonnelEntity>,
    @Optional() private readonly audit?: AuditService,
  ) {}

  async list(organizationId: string, query: LeaveListQuery = {}) {
    const qb = this.leaves
      .createQueryBuilder('l')
      .where('l.organizationId = :org', { org: organizationId });

    if (query.status) qb.andWhere('l.status = :s', { s: query.status });
    if (query.type) qb.andWhere('l.type = :t', { t: query.type });
    if (query.personnelId) {
      qb.andWhere('l.personnelId = :p', { p: query.personnelId });
    }
    if (query.departmentId) {
      qb.andWhere('l.departmentId = :d', { d: query.departmentId });
    }
    // هم‌پوشانیِ بازه، نه فقط تاریخِ ثبت: «چه کسی این هفته مرخصی است؟»
    if (query.from) qb.andWhere('l.toDate >= :from', { from: query.from });
    if (query.to) qb.andWhere('l.fromDate <= :to', { to: query.to });

    const pageSize = Math.min(
      Math.max(Number(query.pageSize ?? 25), 1),
      MAX_PAGE_SIZE,
    );
    const page = Math.max(Number(query.page ?? 1), 1);
    qb.orderBy('l.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [rows, total] = await qb.getManyAndCount();
    return { rows: await this.withNames(rows), total, page, pageSize };
  }

  async get(organizationId: string, id: string) {
    const row = await this.leaves.findOne({ where: { id, organizationId } });
    if (!row) throw new NotFoundException('درخواستِ مرخصی یافت نشد');
    return row;
  }

  /** ثبتِ درخواستِ مرخصی؛ روزها همین‌جا حساب و ذخیره می‌شوند. */
  async create(
    organizationId: string,
    input: {
      personnelId: string;
      type?: LeaveType;
      fromDate: string;
      toDate: string;
      reason?: string;
      days?: number;
    },
    actorId?: string,
  ) {
    const person = await this.personnel.findOne({
      where: { id: input.personnelId, organizationId },
    });
    if (!person) throw new NotFoundException('پرسنل یافت نشد');

    if (!input.fromDate || !input.toDate) {
      throw new BadRequestException('بازه‌ی تاریخ لازم است');
    }
    if (input.toDate < input.fromDate) {
      throw new BadRequestException('تاریخِ پایان پیش از شروع است');
    }

    const type = input.type ?? LeaveType.ANNUAL;
    /*
     * مرخصیِ ساعتی روز را خودِ کاربر می‌دهد (مثلاً ۰٫۵)؛ بقیه از بازه حساب
     * می‌شوند تا کسی نتواند عددِ دلخواه بفرستد.
     */
    const days =
      type === LeaveType.HOURLY
        ? Math.max(Number(input.days ?? 0), 0)
        : countDays(input.fromDate, input.toDate);
    if (days <= 0) throw new BadRequestException('تعدادِ روز معتبر نیست');

    // هم‌پوشانی با مرخصیِ ثبت‌شده‌ی همان فرد جلوگیری می‌شود.
    const clash = await this.leaves
      .createQueryBuilder('l')
      .where('l.organizationId = :org', { org: organizationId })
      .andWhere('l.personnelId = :p', { p: input.personnelId })
      .andWhere('l.status IN (:...s)', {
        s: [LeaveStatus.PENDING, LeaveStatus.APPROVED],
      })
      .andWhere('l.toDate >= :from', { from: input.fromDate })
      .andWhere('l.fromDate <= :to', { to: input.toDate })
      .getCount();
    if (clash > 0) {
      throw new BadRequestException(
        'برای این بازه مرخصیِ ثبت‌شده یا در انتظارِ تأیید وجود دارد',
      );
    }

    const count = await this.leaves.count({ where: { organizationId } });
    const number = `LV-${String(count + 1).padStart(5, '0')}`;

    const saved = await this.leaves.save(
      this.leaves.create({
        organizationId,
        number,
        personnelId: input.personnelId,
        departmentId: person.departmentId,
        type,
        fromDate: input.fromDate,
        toDate: input.toDate,
        days,
        reason: input.reason ?? '',
        status: LeaveStatus.PENDING,
        history: [],
      }),
    );
    this.log(actorId, organizationId, 'hr.leave.create', saved.id, { number });
    return saved;
  }

  /**
   * تصمیمِ مدیر دربارهٔ مرخصی.
   *
   * تأییدِ مرخصیِ جاری، وضعیتِ اشتغالِ کارمند را هم «در مرخصی» می‌کند تا
   * گزارشِ نیروی حاضر درست بماند.
   */
  async decide(
    organizationId: string,
    id: string,
    next: LeaveStatus,
    opts: { note?: string; actorId?: string } = {},
  ) {
    const row = await this.get(organizationId, id);
    const allowed = TRANSITIONS[row.status] ?? [];
    if (!allowed.includes(next)) {
      throw new BadRequestException(
        `گذار از «${row.status}» به «${next}» مجاز نیست`,
      );
    }

    const step: LeaveHistoryStep = {
      at: new Date().toISOString(),
      from: row.status,
      to: next,
      byUserId: opts.actorId ?? null,
      note: opts.note,
    };
    row.history = [...(row.history ?? []), step];
    row.status = next;
    row.decidedByUserId = opts.actorId ?? null;
    row.decidedAt = new Date();
    row.decisionNote = opts.note ?? '';
    const saved = await this.leaves.save(row);

    if (next === LeaveStatus.APPROVED) {
      const today = todayIso();
      if (row.fromDate <= today && row.toDate >= today) {
        await this.personnel.update(
          { id: row.personnelId, organizationId },
          { employmentStatus: EmploymentStatus.ON_LEAVE },
        );
      }
    }

    this.log(opts.actorId, organizationId, 'hr.leave.decide', id, {
      to: next,
    });
    return saved;
  }

  // ── ماندهٔ مرخصی ──────────────────────────────────────────────────────

  /** سقفِ مرخصیِ یک کارمند در یک سال را تعیین می‌کند. */
  async setBalance(
    organizationId: string,
    input: {
      personnelId: string;
      year: number;
      type?: LeaveType;
      entitledDays: number;
    },
    actorId?: string,
  ) {
    const type = input.type ?? LeaveType.ANNUAL;
    const existing = await this.balances.findOne({
      where: { personnelId: input.personnelId, year: input.year, type },
    });
    const row = existing
      ? Object.assign(existing, { entitledDays: input.entitledDays })
      : this.balances.create({ ...input, type, organizationId });
    const saved = await this.balances.save(row);
    this.log(actorId, organizationId, 'hr.leave.balance', saved.id, {
      personnelId: input.personnelId,
      year: input.year,
    });
    return saved;
  }

  /**
   * ماندهٔ مرخصیِ یک کارمند: سقف منهای مصرفِ تأییدشده.
   *
   * مصرف از خودِ مرخصی‌های تأییدشده شمرده می‌شود، نه عددِ جداگانه‌ای که
   * ممکن است با واقعیت واگرا شود.
   */
  async balanceOf(organizationId: string, personnelId: string, year: number) {
    const [entitlements, approved] = await Promise.all([
      this.balances.find({ where: { organizationId, personnelId, year } }),
      this.leaves.find({
        where: {
          organizationId,
          personnelId,
          status: LeaveStatus.APPROVED,
        },
      }),
    ]);

    const usedByType = new Map<string, number>();
    for (const l of approved) {
      // سالِ میلادیِ شروعِ مرخصی مبنا است؛ سالِ شمسی را UI تبدیل می‌کند.
      const y = Number(l.fromDate.slice(0, 4));
      if (y !== year) continue;
      usedByType.set(l.type, (usedByType.get(l.type) ?? 0) + l.days);
    }

    const types = new Set<string>([
      ...entitlements.map((e) => e.type as string),
      ...usedByType.keys(),
    ]);
    return [...types].map((type) => {
      const entitled =
        entitlements.find((e) => e.type === type)?.entitledDays ?? 0;
      const used = usedByType.get(type) ?? 0;
      return { type, entitled, used, remaining: entitled - used };
    });
  }

  // ── داشبوردِ HR ───────────────────────────────────────────────────────

  /**
   * خلاصهٔ قابلِ‌اقدامِ منابع انسانی.
   *
   * مثلِ داشبوردِ فنی، هر سطل `filter` خودش را دارد تا به رکوردها برسد.
   */
  async summary(organizationId: string) {
    const today = todayIso();
    // قراردادهایی که تا ۳۰ روزِ آینده تمام می‌شوند.
    const soon = new Date(Date.now() + 30 * 86400000)
      .toISOString()
      .slice(0, 10);

    const [pending, onLeaveToday, expiring, headcount, terminated] =
      await Promise.all([
        this.leaves.count({
          where: { organizationId, status: LeaveStatus.PENDING },
        }),
        this.leaves
          .createQueryBuilder('l')
          .where('l.organizationId = :org', { org: organizationId })
          .andWhere('l.status = :s', { s: LeaveStatus.APPROVED })
          .andWhere('l.fromDate <= :t', { t: today })
          .andWhere('l.toDate >= :t2', { t2: today })
          .getCount(),
        this.personnel
          .createQueryBuilder('p')
          .where('p.organizationId = :org', { org: organizationId })
          .andWhere('p.isActive = :a', { a: true })
          .andWhere("p.contractEndsAt <> ''")
          .andWhere('p.contractEndsAt <= :soon', { soon })
          .getCount(),
        this.personnel.count({
          where: {
            organizationId,
            isActive: true,
            employmentStatus: In([
              EmploymentStatus.ACTIVE,
              EmploymentStatus.ON_LEAVE,
            ]),
          },
        }),
        this.personnel.count({
          where: {
            organizationId,
            employmentStatus: EmploymentStatus.TERMINATED,
          },
        }),
      ]);

    return {
      buckets: [
        {
          key: 'pendingLeaves',
          label: 'مرخصیِ منتظرِ تأیید',
          count: pending,
          kind: 'leave' as const,
          filter: { status: LeaveStatus.PENDING },
          tone: 'warn' as const,
        },
        {
          key: 'onLeaveToday',
          label: 'امروز در مرخصی',
          count: onLeaveToday,
          kind: 'leave' as const,
          filter: { status: LeaveStatus.APPROVED, from: today, to: today },
          tone: 'info' as const,
        },
        {
          key: 'contractsExpiring',
          label: 'قراردادِ رو به پایان (۳۰ روز)',
          count: expiring,
          kind: 'personnel' as const,
          filter: { contractExpiring: true },
          tone: 'danger' as const,
        },
      ],
      headcount,
      terminated,
      generatedAt: new Date(),
    };
  }

  /** نامِ پرسنل را به ردیف‌ها می‌چسباند تا پنل شناسه‌ی خام نشان ندهد. */
  private async withNames(rows: LeaveRequestEntity[]) {
    if (rows.length === 0) return [];
    const people = await this.personnel.find({
      where: { id: In(rows.map((r) => r.personnelId)) },
      select: { id: true, fullName: true, employeeNo: true },
    });
    const byId = new Map(people.map((p) => [p.id, p]));
    return rows.map((r) => ({
      ...r,
      personnelName: byId.get(r.personnelId)?.fullName ?? 'نامشخص',
      employeeNo: byId.get(r.personnelId)?.employeeNo ?? '',
    }));
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
        actorType: 'user',
        actorId: actorId ?? null,
        payload: { entityId, ...meta },
      })
      .catch(() => undefined);
  }
}
