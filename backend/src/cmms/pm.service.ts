import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import {
  PM_INTERVAL_DAYS,
  PmInterval,
  PmScheduleEntity,
} from '../database/entities/pm-schedule.entity';
import { WorkOrderStatus } from '../database/entities/work-order.entity';
import { AuditService } from '../common/audit.service';
import { CmmsService } from './cmms.service';

/** هر ساعت کافی است؛ موعدها روزانه‌اند نه دقیقه‌ای. */
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

/** امروز به‌شکلِ YYYY-MM-DD. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** `days` روز بعد از یک تاریخِ ISO. */
export function addDays(iso: string, days: number): string {
  const base = Date.parse(`${iso}T00:00:00Z`);
  if (!Number.isFinite(base)) return iso;
  return new Date(base + days * 86400000).toISOString().slice(0, 10);
}

/** طولِ دوره‌ی یک برنامه بر حسبِ روز. */
export function intervalDaysOf(schedule: {
  interval: PmInterval;
  intervalDays: number;
}): number {
  if (schedule.interval === PmInterval.CUSTOM) {
    return Math.max(1, schedule.intervalDays);
  }
  return PM_INTERVAL_DAYS[schedule.interval];
}

/**
 * نگهداریِ پیشگیرانه.
 *
 * برنامه فقط تقویم نیست: وقتی موعد می‌رسد خودِ سامانه دستورِ کار می‌سازد،
 * چک‌لیست و تکنسین‌ها را رویش کپی می‌کند و موعدِ بعدی را جلو می‌برد. بدونِ
 * این، «پیشگیرانه» یادداشتی می‌ماند که کسی اجرایش نمی‌کند.
 */
@Injectable()
export class PmService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PmService.name);
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    @InjectRepository(PmScheduleEntity)
    private readonly schedules: Repository<PmScheduleEntity>,
    private readonly cmms: CmmsService,
    @Optional() private readonly audit?: AuditService,
  ) {}

  onModuleInit() {
    if (process.env.PM_DISABLED === '1') {
      this.logger.log('تولیدِ خودکارِ نگهداریِ پیشگیرانه خاموش است (PM_DISABLED).');
      return;
    }
    this.timer = setInterval(() => void this.run(), CHECK_INTERVAL_MS);
    // نگذار تایمر، خاموش‌شدنِ پروسه را عقب بیندازد.
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  // ── مدیریتِ برنامه ────────────────────────────────────────────────────

  list(organizationId: string) {
    return this.schedules.find({
      where: { organizationId },
      order: { nextDueAt: 'ASC' },
    });
  }

  async get(organizationId: string, id: string) {
    const row = await this.schedules.findOne({
      where: { id, organizationId },
    });
    if (!row) throw new NotFoundException('برنامهٔ نگهداری یافت نشد');
    return row;
  }

  async create(
    organizationId: string,
    input: Partial<PmScheduleEntity>,
    actorId?: string,
  ) {
    if (!(input.title ?? '').trim()) {
      throw new BadRequestException('عنوانِ برنامه لازم است');
    }
    if (input.assetId) await this.cmms.getAsset(organizationId, input.assetId);
    if (
      input.interval === PmInterval.CUSTOM &&
      Number(input.intervalDays ?? 0) < 1
    ) {
      throw new BadRequestException('فاصله‌ی دلخواه باید دست‌کم ۱ روز باشد');
    }

    const saved = await this.schedules.save(
      this.schedules.create({
        ...input,
        organizationId,
        // موعدِ اول: اگر داده نشده، از امروز یک دوره جلوتر.
        nextDueAt:
          input.nextDueAt ||
          addDays(
            todayIso(),
            intervalDaysOf({
              interval: input.interval ?? PmInterval.MONTHLY,
              intervalDays: Number(input.intervalDays ?? 0),
            }),
          ),
      } as Partial<PmScheduleEntity>),
    );
    this.log(actorId, organizationId, 'pm.create', saved.id, {
      title: saved.title,
    });
    return saved;
  }

  async update(
    organizationId: string,
    id: string,
    input: Partial<PmScheduleEntity>,
    actorId?: string,
  ) {
    const row = await this.get(organizationId, id);
    const { organizationId: _o, id: _i, ...patch } = input as Record<
      string,
      never
    >;
    Object.assign(row, patch);
    const saved = await this.schedules.save(row);
    this.log(actorId, organizationId, 'pm.update', id, {});
    return saved;
  }

  /** برنامه‌هایی که موعدشان رسیده (برای نمای «سررسیده»). */
  due(organizationId: string, onDate = todayIso()) {
    return this.schedules.find({
      where: {
        organizationId,
        isActive: true,
        nextDueAt: LessThanOrEqual(onDate),
      },
      order: { nextDueAt: 'ASC' },
    });
  }

  // ── تولیدِ خودکار ─────────────────────────────────────────────────────

  /**
   * برای هر برنامه‌ی سررسیده یک دستورِ کار می‌سازد و موعد را جلو می‌برد.
   *
   * تعدادِ دستورِ کارهای ساخته‌شده برمی‌گردد. قابلِ فراخوانیِ دستی هم هست تا
   * تست و «اجرای همین حالا» ممکن باشد.
   */
  async run(onDate = todayIso()): Promise<number> {
    const rows = await this.schedules.find({
      where: { isActive: true, nextDueAt: LessThanOrEqual(onDate) },
      order: { nextDueAt: 'ASC' },
      take: 200,
    });

    let made = 0;
    for (const schedule of rows) {
      try {
        await this.generateFor(schedule, onDate);
        made += 1;
      } catch (error) {
        // یک برنامه‌ی خراب نباید بقیه را متوقف کند.
        this.logger.warn(
          `ساختِ دستورِ کارِ پیشگیرانه برای «${schedule.title}» ناموفق بود: ${
            (error as Error).message
          }`,
        );
      }
    }
    if (made > 0) {
      this.logger.log(`${made} دستورِ کارِ نگهداریِ پیشگیرانه ساخته شد.`);
    }
    return made;
  }

  /** ساختِ دستورِ کار برای یک برنامه و جلو بردنِ موعد. */
  async generateFor(schedule: PmScheduleEntity, onDate = todayIso()) {
    const order = await this.cmms.createWorkOrder(schedule.organizationId, {
      title: schedule.title,
      assetId: schedule.assetId,
      roomId: schedule.roomId,
      departmentId: schedule.departmentId,
      category: schedule.category,
      workDescription: schedule.instructions,
      checklist: schedule.checklist ?? [],
      technicianIds: schedule.technicianIds ?? [],
      // موعدِ انجام همان موعدِ برنامه است، تا «عقب‌افتاده» معنا پیدا کند.
      dueDate: schedule.nextDueAt,
    });

    /*
     * موعدِ بعدی از موعدِ قبلی جلو می‌رود، نه از امروز.
     *
     * وگرنه اگر سامانه چند روز خاموش بوده باشد، برنامه‌ی ماهانه به‌تدریج
     * عقب می‌افتاد. اگر خیلی عقب مانده، جلو می‌آید تا در آینده بیفتد.
     */
    const step = intervalDaysOf(schedule);
    let next = addDays(schedule.nextDueAt, step);
    while (next <= onDate) next = addDays(next, step);

    schedule.nextDueAt = next;
    schedule.lastGeneratedAt = new Date();
    schedule.lastWorkOrderId = order.id;
    await this.schedules.save(schedule);

    this.log(undefined, schedule.organizationId, 'pm.generate', schedule.id, {
      workOrderId: order.id,
      nextDueAt: next,
    });
    return order;
  }

  /** خلاصه‌ی پیشگیرانه برای داشبوردِ فنی. */
  async summary(organizationId: string, onDate = todayIso()) {
    const [dueNow, active] = await Promise.all([
      this.schedules.count({
        where: {
          organizationId,
          isActive: true,
          nextDueAt: LessThanOrEqual(onDate),
        },
      }),
      this.schedules.count({ where: { organizationId, isActive: true } }),
    ]);
    return { dueNow, active };
  }

  /**
   * نرخِ پایبندی به نگهداریِ پیشگیرانه.
   *
   * از دستورِ کارهای تولیدشده‌ی همین برنامه‌ها حساب می‌شود: چند درصدشان به
   * تأیید/بسته رسیده‌اند. عددِ ساختگی نمی‌دهیم؛ اگر دستورِ کاری نباشد `null`.
   */
  async compliance(organizationId: string) {
    const orders = await this.cmms.listWorkOrders(organizationId, {
      pageSize: 200,
    });
    const pmOrders = orders.rows.filter((o) => o.dueDate);
    if (pmOrders.length === 0) return { rate: null, total: 0, done: 0 };
    const done = pmOrders.filter((o) =>
      [
        WorkOrderStatus.VERIFIED,
        WorkOrderStatus.CLOSED,
        WorkOrderStatus.COMPLETED,
      ].includes(o.status),
    ).length;
    return {
      rate: Math.round((done / pmOrders.length) * 100),
      total: pmOrders.length,
      done,
    };
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
