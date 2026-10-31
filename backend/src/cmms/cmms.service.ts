import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Brackets,
  DataSource,
  In,
  ObjectLiteral,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { AssetEntity, AssetStatus } from '../database/entities/asset.entity';
import {
  MaintenancePriority,
  MaintenanceRequestEntity,
  MaintenanceRequestStatus,
  RequestHistoryStep,
} from '../database/entities/maintenance-request.entity';
import {
  WorkOrderEntity,
  WorkOrderStatus,
  WorkOrderTechnicianEntity,
} from '../database/entities/work-order.entity';
import { PersonnelEntity } from '../database/entities/personnel.entity';
import { AuditService } from '../common/audit.service';
import { LIKE_OPERATOR } from '../database/column-types';

/**
 * گذارهای مجازِ وضعیتِ درخواست.
 *
 * صریح نوشته شده تا وضعیت از مسیرِ اشتباه عوض نشود (مثلاً «بسته» دوباره
 * «در حالِ انجام» نشود) و گزارشِ عملیاتی قابلِ اتکا بماند.
 */
const REQUEST_TRANSITIONS: Record<
  MaintenanceRequestStatus,
  MaintenanceRequestStatus[]
> = {
  [MaintenanceRequestStatus.NEW]: [
    MaintenanceRequestStatus.UNDER_REVIEW,
    MaintenanceRequestStatus.APPROVED,
    MaintenanceRequestStatus.REJECTED,
  ],
  [MaintenanceRequestStatus.UNDER_REVIEW]: [
    MaintenanceRequestStatus.APPROVED,
    MaintenanceRequestStatus.REJECTED,
  ],
  [MaintenanceRequestStatus.APPROVED]: [
    MaintenanceRequestStatus.ASSIGNED,
    MaintenanceRequestStatus.REJECTED,
  ],
  [MaintenanceRequestStatus.ASSIGNED]: [
    MaintenanceRequestStatus.IN_PROGRESS,
    MaintenanceRequestStatus.WAITING_PARTS,
    MaintenanceRequestStatus.WAITING_CONTRACTOR,
  ],
  [MaintenanceRequestStatus.IN_PROGRESS]: [
    MaintenanceRequestStatus.WAITING_PARTS,
    MaintenanceRequestStatus.WAITING_CONTRACTOR,
    MaintenanceRequestStatus.FOLLOW_UP,
    MaintenanceRequestStatus.COMPLETED,
  ],
  [MaintenanceRequestStatus.WAITING_PARTS]: [
    MaintenanceRequestStatus.IN_PROGRESS,
    MaintenanceRequestStatus.FOLLOW_UP,
  ],
  [MaintenanceRequestStatus.WAITING_CONTRACTOR]: [
    MaintenanceRequestStatus.IN_PROGRESS,
    MaintenanceRequestStatus.FOLLOW_UP,
  ],
  [MaintenanceRequestStatus.FOLLOW_UP]: [
    MaintenanceRequestStatus.IN_PROGRESS,
    MaintenanceRequestStatus.COMPLETED,
  ],
  [MaintenanceRequestStatus.COMPLETED]: [MaintenanceRequestStatus.CLOSED],
  [MaintenanceRequestStatus.REJECTED]: [MaintenanceRequestStatus.CLOSED],
  [MaintenanceRequestStatus.CLOSED]: [],
};

/** گذارهای مجازِ وضعیتِ دستورِ کار. */
const WORK_ORDER_TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  [WorkOrderStatus.DRAFT]: [
    WorkOrderStatus.ASSIGNED,
    WorkOrderStatus.CANCELLED,
  ],
  [WorkOrderStatus.ASSIGNED]: [
    WorkOrderStatus.IN_PROGRESS,
    WorkOrderStatus.CANCELLED,
  ],
  [WorkOrderStatus.IN_PROGRESS]: [
    WorkOrderStatus.WAITING_PARTS,
    WorkOrderStatus.WAITING_CONTRACTOR,
    WorkOrderStatus.COMPLETED,
    WorkOrderStatus.CANCELLED,
  ],
  [WorkOrderStatus.WAITING_PARTS]: [
    WorkOrderStatus.IN_PROGRESS,
    WorkOrderStatus.CANCELLED,
  ],
  [WorkOrderStatus.WAITING_CONTRACTOR]: [
    WorkOrderStatus.IN_PROGRESS,
    WorkOrderStatus.CANCELLED,
  ],
  // تکمیل به‌خودیِ‌خود «تأییدشده» نیست؛ مدیر باید تأیید کند.
  [WorkOrderStatus.COMPLETED]: [
    WorkOrderStatus.VERIFIED,
    WorkOrderStatus.IN_PROGRESS,
  ],
  [WorkOrderStatus.VERIFIED]: [WorkOrderStatus.CLOSED],
  [WorkOrderStatus.CLOSED]: [],
  [WorkOrderStatus.CANCELLED]: [],
};

/*
 * ورودی‌های سرویس.
 *
 * فیلدهای JSON در DTO با `@IsArray()` اعتبارسنجی می‌شوند و شکلِ دقیقشان را
 * class-validator نمی‌سنجد، پس اینجا آزادتر گرفته می‌شوند و هنگامِ ذخیره به
 * نوعِ موجودیت تبدیل می‌شوند.
 */
export type AssetInput = Partial<Omit<AssetEntity, 'documents'>> & {
  documents?: unknown[];
};

export type RequestInput = Partial<
  Omit<MaintenanceRequestEntity, 'attachments' | 'history'>
> & { attachments?: unknown[] };

export type WorkOrderInput = Partial<
  Omit<WorkOrderEntity, 'parts' | 'attachments' | 'checklist' | 'history'>
> & {
  parts?: unknown[];
  attachments?: unknown[];
  checklist?: unknown[];
  technicianIds?: string[];
};

export interface ListQuery {
  status?: string;
  priority?: string;
  category?: string;
  departmentId?: string;
  assetId?: string;
  search?: string;
  from?: string;
  to?: string;
  /** فقط کارهای عقب‌افتاده: موعد گذشته و هنوز بسته نشده. */
  overdue?: boolean | string;
  page?: number;
  pageSize?: number;
}

/** وضعیت‌هایی که دیگر «کارِ باز» نیستند. */
const CLOSED_REQUEST_STATUSES = [
  MaintenanceRequestStatus.COMPLETED,
  MaintenanceRequestStatus.REJECTED,
  MaintenanceRequestStatus.CLOSED,
];
const CLOSED_WORK_ORDER_STATUSES = [
  WorkOrderStatus.COMPLETED,
  WorkOrderStatus.VERIFIED,
  WorkOrderStatus.CLOSED,
  WorkOrderStatus.CANCELLED,
];

/** امروز به‌شکلِ YYYY-MM-DD؛ ستونِ موعد هم رشته‌ی ISO است. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const MAX_PAGE_SIZE = 200;

/**
 * دامنهٔ CMMS: دارایی، درخواستِ تعمیر و دستورِ کار.
 *
 * `organizationId` همیشه از توکن می‌آید (کنترلر آن را می‌دهد)، نه از بدنه‌ی
 * کلاینت؛ پس هیچ پرس‌وجویی بدونِ قیدِ سازمان نیست.
 */
@Injectable()
export class CmmsService {
  constructor(
    @InjectRepository(AssetEntity)
    private readonly assets: Repository<AssetEntity>,
    @InjectRepository(MaintenanceRequestEntity)
    private readonly requests: Repository<MaintenanceRequestEntity>,
    @InjectRepository(WorkOrderEntity)
    private readonly workOrders: Repository<WorkOrderEntity>,
    @InjectRepository(WorkOrderTechnicianEntity)
    private readonly technicians: Repository<WorkOrderTechnicianEntity>,
    @InjectRepository(PersonnelEntity)
    private readonly personnel: Repository<PersonnelEntity>,
    private readonly dataSource: DataSource,
    @Optional() private readonly audit?: AuditService,
  ) {}

  // ── دارایی ────────────────────────────────────────────────────────────

  async listAssets(organizationId: string, query: ListQuery = {}) {
    const qb = this.assets
      .createQueryBuilder('a')
      .where('a.organizationId = :org', { org: organizationId });

    if (query.status) qb.andWhere('a.status = :st', { st: query.status });
    if (query.departmentId) {
      qb.andWhere('a.departmentId = :dep', { dep: query.departmentId });
    }
    if (query.search) {
      const like = `%${query.search}%`;
      qb.andWhere(
        new Brackets((w) =>
          w
            .where(`a.name ${LIKE_OPERATOR} :like`, { like })
            .orWhere(`a.code ${LIKE_OPERATOR} :like`, { like })
            .orWhere(`a.serialNumber ${LIKE_OPERATOR} :like`, { like }),
        ),
      );
    }
    return this.paginate(qb, 'a.createdAt', query);
  }

  async getAsset(organizationId: string, id: string) {
    const asset = await this.assets.findOne({
      where: { id, organizationId },
    });
    if (!asset) throw new NotFoundException('دارایی یافت نشد');
    return asset;
  }

  async createAsset(
    organizationId: string,
    dto: AssetInput,
    actorId?: string,
  ) {
    const code = (dto.code ?? '').trim();
    if (!code) throw new BadRequestException('کدِ دارایی لازم است');
    const clash = await this.assets.findOne({
      where: { organizationId, code },
      select: { id: true },
    });
    if (clash) throw new BadRequestException('کدِ دارایی تکراری است');

    if (dto.parentId) await this.getAsset(organizationId, dto.parentId);

    const saved = await this.assets.save(
      this.assets.create({ ...dto, code, organizationId } as Partial<AssetEntity>),
    );
    this.log(actorId, organizationId, 'asset.create', saved.id, {
      code: saved.code,
    });
    return saved;
  }

  async updateAsset(
    organizationId: string,
    id: string,
    dto: AssetInput,
    actorId?: string,
  ) {
    const asset = await this.getAsset(organizationId, id);
    // دارایی نباید والدِ خودش شود.
    if (dto.parentId) {
      if (dto.parentId === id) {
        throw new BadRequestException('دارایی نمی‌تواند والدِ خودش باشد');
      }
      await this.getAsset(organizationId, dto.parentId);
    }
    // سازمان و کلیدِ اصلی از بدنه قابلِ تغییر نیستند.
    const { organizationId: _o, id: _i, ...patch } = dto as Record<string, never>;
    Object.assign(asset, patch);
    const saved = await this.assets.save(asset);
    this.log(actorId, organizationId, 'asset.update', id, {});
    return saved;
  }

  // ── درخواستِ تعمیر ────────────────────────────────────────────────────

  async listRequests(organizationId: string, query: ListQuery = {}) {
    const qb = this.requests
      .createQueryBuilder('r')
      .where('r.organizationId = :org', { org: organizationId });
    this.applyCommonFilters(qb, 'r', query);
    if (query.assetId) qb.andWhere('r.assetId = :a', { a: query.assetId });
    if (query.search) {
      const like = `%${query.search}%`;
      qb.andWhere(
        new Brackets((w) =>
          w
            .where(`r.title ${LIKE_OPERATOR} :like`, { like })
            .orWhere(`r.number ${LIKE_OPERATOR} :like`, { like })
            .orWhere(`r.description ${LIKE_OPERATOR} :like`, { like }),
        ),
      );
    }
    return this.paginate(qb, 'r.createdAt', query);
  }

  async getRequest(organizationId: string, id: string) {
    const row = await this.requests.findOne({ where: { id, organizationId } });
    if (!row) throw new NotFoundException('درخواست یافت نشد');
    return row;
  }

  async createRequest(
    organizationId: string,
    dto: RequestInput,
    actorId?: string,
  ) {
    if (!(dto.title ?? '').trim()) {
      throw new BadRequestException('عنوانِ درخواست لازم است');
    }
    if (dto.assetId) await this.getAsset(organizationId, dto.assetId);

    const number = await this.nextNumber('maintenance_requests', organizationId);
    const saved = await this.requests.save(
      this.requests.create({
        ...dto,
        organizationId,
        number,
        status: MaintenanceRequestStatus.NEW,
        history: [],
      } as Partial<MaintenanceRequestEntity>),
    );
    this.log(actorId, organizationId, 'maintenance.request.create', saved.id, {
      number,
    });
    return saved;
  }

  /** گذارِ وضعیتِ درخواست با بررسیِ مجاز بودن و ثبتِ تاریخچه. */
  async changeRequestStatus(
    organizationId: string,
    id: string,
    next: MaintenanceRequestStatus,
    opts: { note?: string; actorId?: string } = {},
  ) {
    const row = await this.getRequest(organizationId, id);
    const allowed = REQUEST_TRANSITIONS[row.status] ?? [];
    if (!allowed.includes(next)) {
      throw new BadRequestException(
        `گذار از «${row.status}» به «${next}» مجاز نیست`,
      );
    }

    const step: RequestHistoryStep = {
      at: new Date().toISOString(),
      from: row.status,
      to: next,
      byUserId: opts.actorId ?? null,
      note: opts.note,
    };
    row.history = [...(row.history ?? []), step];
    row.status = next;
    if (next === MaintenanceRequestStatus.REJECTED && opts.note) {
      row.rejectionReason = opts.note;
    }
    if (next === MaintenanceRequestStatus.COMPLETED) {
      row.completedAt = new Date();
    }
    const saved = await this.requests.save(row);
    this.log(opts.actorId, organizationId, 'maintenance.request.status', id, {
      from: step.from,
      to: step.to,
    });
    return saved;
  }

  // ── دستورِ کار ────────────────────────────────────────────────────────

  async listWorkOrders(organizationId: string, query: ListQuery = {}) {
    const qb = this.workOrders
      .createQueryBuilder('w')
      .where('w.organizationId = :org', { org: organizationId });
    this.applyCommonFilters(qb, 'w', query);
    if (query.assetId) qb.andWhere('w.assetId = :a', { a: query.assetId });
    if (query.search) {
      const like = `%${query.search}%`;
      qb.andWhere(
        new Brackets((w) =>
          w
            .where(`w.title ${LIKE_OPERATOR} :like`, { like })
            .orWhere(`w.number ${LIKE_OPERATOR} :like`, { like }),
        ),
      );
    }
    return this.paginate(qb, 'w.createdAt', query);
  }

  async getWorkOrder(organizationId: string, id: string) {
    const row = await this.workOrders.findOne({
      where: { id, organizationId },
    });
    if (!row) throw new NotFoundException('دستورِ کار یافت نشد');
    const techs = await this.technicians.find({
      where: { workOrderId: id },
    });
    return { ...row, technicians: techs };
  }

  /**
   * ساختِ دستورِ کار؛ اگر از درخواست زاده شود، درخواست به «ارجاع‌شده» می‌رود.
   *
   * هر دو نوشتن در یک تراکنش‌اند تا دستورِ کارِ بی‌درخواست یا درخواستِ
   * وضعیت‌عوض‌شده‌ی بی‌دستورِکار باقی نماند.
   */
  async createWorkOrder(
    organizationId: string,
    dto: WorkOrderInput,
    actorId?: string,
  ) {
    if (!(dto.title ?? '').trim()) {
      throw new BadRequestException('عنوانِ دستورِ کار لازم است');
    }
    if (dto.assetId) await this.getAsset(organizationId, dto.assetId);
    const request = dto.requestId
      ? await this.getRequest(organizationId, dto.requestId)
      : null;

    const number = await this.nextNumber('work_orders', organizationId);
    const { technicianIds = [], ...rest } = dto;

    return this.dataSource.transaction(async (manager) => {
      const order = await manager.save(
        manager.create(WorkOrderEntity, {
          ...rest,
          organizationId,
          number,
          status:
            technicianIds.length > 0
              ? WorkOrderStatus.ASSIGNED
              : WorkOrderStatus.DRAFT,
          history: [],
        } as Partial<WorkOrderEntity>),
      );

      for (const [i, personnelId] of technicianIds.entries()) {
        await manager.save(
          manager.create(WorkOrderTechnicianEntity, {
            workOrderId: order.id,
            personnelId,
            isPrimary: i === 0,
          }),
        );
      }

      if (
        request &&
        (REQUEST_TRANSITIONS[request.status] ?? []).includes(
          MaintenanceRequestStatus.ASSIGNED,
        )
      ) {
        request.history = [
          ...(request.history ?? []),
          {
            at: new Date().toISOString(),
            from: request.status,
            to: MaintenanceRequestStatus.ASSIGNED,
            byUserId: actorId ?? null,
            note: `دستورِ کار ${number}`,
          },
        ];
        request.status = MaintenanceRequestStatus.ASSIGNED;
        await manager.save(request);
      }

      this.log(actorId, organizationId, 'workorder.create', order.id, {
        number,
      });
      return order;
    });
  }

  /** گذارِ وضعیتِ دستورِ کار با بررسیِ مجاز بودن. */
  async changeWorkOrderStatus(
    organizationId: string,
    id: string,
    next: WorkOrderStatus,
    opts: { note?: string; actorId?: string } = {},
  ) {
    const row = await this.workOrders.findOne({
      where: { id, organizationId },
    });
    if (!row) throw new NotFoundException('دستورِ کار یافت نشد');

    const allowed = WORK_ORDER_TRANSITIONS[row.status] ?? [];
    if (!allowed.includes(next)) {
      throw new BadRequestException(
        `گذار از «${row.status}» به «${next}» مجاز نیست`,
      );
    }

    row.history = [
      ...(row.history ?? []),
      {
        at: new Date().toISOString(),
        from: row.status,
        to: next,
        byUserId: opts.actorId ?? null,
        note: opts.note,
      },
    ];
    row.status = next;
    if (next === WorkOrderStatus.IN_PROGRESS && !row.startedAt) {
      row.startedAt = new Date();
    }
    if (next === WorkOrderStatus.COMPLETED) row.completedAt = new Date();
    if (next === WorkOrderStatus.VERIFIED) {
      row.verifiedAt = new Date();
      row.verifiedByUserId = opts.actorId ?? null;
    }

    const saved = await this.workOrders.save(row);
    this.log(opts.actorId, organizationId, 'workorder.status', id, {
      to: next,
    });
    return saved;
  }

  // ── کمک‌ها ────────────────────────────────────────────────────────────

  private applyCommonFilters<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    alias: string,
    query: ListQuery,
  ) {
    if (query.status) {
      qb.andWhere(`${alias}.status = :st`, { st: query.status });
    }
    if (query.priority) {
      qb.andWhere(`${alias}.priority = :pr`, { pr: query.priority });
    }
    if (query.category) {
      qb.andWhere(`${alias}.category = :ct`, { ct: query.category });
    }
    if (query.departmentId) {
      qb.andWhere(`${alias}.departmentId = :dep`, { dep: query.departmentId });
    }
    if (query.from) {
      qb.andWhere(`${alias}.createdAt >= :from`, { from: new Date(query.from) });
    }
    if (query.to) {
      qb.andWhere(`${alias}.createdAt <= :to`, { to: new Date(query.to) });
    }
    /*
     * «معوق» یعنی موعد گذشته و کار هنوز باز است.
     *
     * موعدِ خالی معوق نیست؛ وگرنه هر رکوردِ بی‌موعد در فهرستِ عقب‌افتاده‌ها
     * می‌نشست و عدد بی‌معنا می‌شد.
     */
    if (query.overdue === true || query.overdue === 'true') {
      const closed =
        alias === 'w' ? CLOSED_WORK_ORDER_STATUSES : CLOSED_REQUEST_STATUSES;
      qb.andWhere(`${alias}.dueDate <> ''`)
        .andWhere(`${alias}.dueDate < :today`, { today: todayIso() })
        .andWhere(`${alias}.status NOT IN (:...closed)`, { closed });
    }
  }

  /** صفحه‌بندیِ امن با سقف، تا یک کوئری کلِ جدول را نکشد. */
  private async paginate<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    orderField: string,
    query: ListQuery,
  ) {
    const pageSize = Math.min(
      Math.max(Number(query.pageSize ?? 25), 1),
      MAX_PAGE_SIZE,
    );
    const page = Math.max(Number(query.page ?? 1), 1);
    qb.orderBy(orderField, 'DESC');
    qb.skip((page - 1) * pageSize);
    qb.take(pageSize);
    const [rows, total] = await qb.getManyAndCount();
    return { rows, total, page, pageSize };
  }

  /**
   * شمارهٔ خوانای بعدی در هر سازمان.
   *
   * بر پایهٔ تعدادِ رکوردهای همان سازمان است و با ایندکسِ یکتا (organizationId,
   * number) محافظت می‌شود؛ اگر دو درخواست هم‌زمان یک شماره بگیرند، دومی خطا
   * می‌خورد و دوباره تلاش می‌کند.
   */
  private async nextNumber(
    table: 'maintenance_requests' | 'work_orders',
    organizationId: string,
  ): Promise<string> {
    const repo =
      table === 'work_orders'
        ? (this.workOrders as Repository<{ organizationId: string }>)
        : (this.requests as Repository<{ organizationId: string }>);
    const count = await repo.count({ where: { organizationId } });
    const prefix = table === 'work_orders' ? 'WO' : 'MR';
    return `${prefix}-${String(count + 1).padStart(5, '0')}`;
  }

  /** ممیزی بهترین‌تلاش است و هرگز مسیرِ اصلی را نمی‌شکند. */
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

  // ── داشبوردِ عملیاتی ──────────────────────────────────────────────────

  /**
   * خلاصهٔ قابلِ‌اقدامِ بخشِ فنی.
   *
   * هر «سطل» هم عدد دارد هم `kind` و `filter` که همان فهرست را بازمی‌سازد؛
   * پس هر KPI روی داشبورد به رکوردهای زیرینش drill-down می‌شود و عددِ
   * تزئینی نمی‌ماند. محدودهٔ بخش (اختیاری) برای میزِ کارِ مدیرِ بخش است.
   */
  async operationalSummary(
    organizationId: string,
    opts: { departmentId?: string } = {},
  ) {
    const dep = opts.departmentId;
    const scope = <T extends ObjectLiteral>(
      qb: SelectQueryBuilder<T>,
      alias: string,
    ) => {
      if (dep) qb.andWhere(`${alias}.departmentId = :dep`, { dep });
      return qb;
    };

    const countRequests = (build: (qb: SelectQueryBuilder<MaintenanceRequestEntity>) => void) => {
      const qb = this.requests
        .createQueryBuilder('r')
        .where('r.organizationId = :org', { org: organizationId });
      scope(qb, 'r');
      build(qb);
      return qb.getCount();
    };
    const countOrders = (build: (qb: SelectQueryBuilder<WorkOrderEntity>) => void) => {
      const qb = this.workOrders
        .createQueryBuilder('w')
        .where('w.organizationId = :org', { org: organizationId });
      scope(qb, 'w');
      build(qb);
      return qb.getCount();
    };

    const today = todayIso();
    const [
      newRequests,
      pendingApproval,
      emergency,
      unassigned,
      awaitingWorkOrder,
      inProgress,
      overdue,
      waitingParts,
      waitingContractor,
      assetsDown,
    ] = await Promise.all([
      countRequests((qb) =>
        qb.andWhere('r.status = :s', { s: MaintenanceRequestStatus.NEW }),
      ),
      countRequests((qb) =>
        qb.andWhere('r.status IN (:...s)', {
          s: [
            MaintenanceRequestStatus.NEW,
            MaintenanceRequestStatus.UNDER_REVIEW,
          ],
        }),
      ),
      countOrders((qb) =>
        qb
          .andWhere('w.priority = :p', { p: MaintenancePriority.EMERGENCY })
          .andWhere('w.status NOT IN (:...c)', {
            c: CLOSED_WORK_ORDER_STATUSES,
          }),
      ),
      countOrders((qb) =>
        qb.andWhere('w.status = :s', { s: WorkOrderStatus.DRAFT }),
      ),
      /*
       * تأییدشده ولی هنوز بی‌دستورِکار.
       *
       * بدونِ این سطل، درخواستی که مدیر تأیید کرده از همه‌ی صف‌ها بیرون
       * می‌افتاد و کسی نمی‌دید که منتظرِ ساختِ دستورِ کار است.
       */
      countRequests((qb) =>
        qb.andWhere('r.status = :s', { s: MaintenanceRequestStatus.APPROVED }),
      ),
      countOrders((qb) =>
        qb.andWhere('w.status = :s', { s: WorkOrderStatus.IN_PROGRESS }),
      ),
      countOrders((qb) =>
        qb
          .andWhere("w.dueDate <> ''")
          .andWhere('w.dueDate < :today', { today })
          .andWhere('w.status NOT IN (:...c)', {
            c: CLOSED_WORK_ORDER_STATUSES,
          }),
      ),
      countOrders((qb) =>
        qb.andWhere('w.status = :s', { s: WorkOrderStatus.WAITING_PARTS }),
      ),
      countOrders((qb) =>
        qb.andWhere('w.status = :s', { s: WorkOrderStatus.WAITING_CONTRACTOR }),
      ),
      (() => {
        const qb = this.assets
          .createQueryBuilder('a')
          .where('a.organizationId = :org', { org: organizationId })
          .andWhere('a.status IN (:...s)', {
            s: [AssetStatus.OUT_OF_SERVICE, AssetStatus.UNDER_MAINTENANCE],
          });
        scope(qb, 'a');
        return qb.getCount();
      })(),
    ]);

    const buckets = [
      {
        key: 'newRequests',
        label: 'درخواست‌های جدید',
        count: newRequests,
        kind: 'request' as const,
        filter: { status: MaintenanceRequestStatus.NEW },
        tone: 'info' as const,
      },
      {
        key: 'pendingApproval',
        label: 'منتظرِ تأیید',
        count: pendingApproval,
        kind: 'request' as const,
        filter: { status: MaintenanceRequestStatus.UNDER_REVIEW },
        tone: 'warn' as const,
      },
      {
        key: 'emergency',
        label: 'کارِ اضطراری',
        count: emergency,
        kind: 'workOrder' as const,
        filter: { priority: MaintenancePriority.EMERGENCY },
        tone: 'danger' as const,
      },
      {
        key: 'unassigned',
        label: 'بی‌متصدی',
        count: unassigned,
        kind: 'workOrder' as const,
        filter: { status: WorkOrderStatus.DRAFT },
        tone: 'warn' as const,
      },
      {
        key: 'awaitingWorkOrder',
        label: 'تأییدشده، بی‌دستورِکار',
        count: awaitingWorkOrder,
        kind: 'request' as const,
        filter: { status: MaintenanceRequestStatus.APPROVED },
        tone: 'warn' as const,
      },
      {
        key: 'inProgress',
        label: 'در حالِ انجام',
        count: inProgress,
        kind: 'workOrder' as const,
        filter: { status: WorkOrderStatus.IN_PROGRESS },
        tone: 'info' as const,
      },
      {
        key: 'overdue',
        label: 'عقب‌افتاده',
        count: overdue,
        kind: 'workOrder' as const,
        filter: { overdue: true },
        tone: 'danger' as const,
      },
      {
        key: 'waitingParts',
        label: 'منتظرِ قطعه',
        count: waitingParts,
        kind: 'workOrder' as const,
        filter: { status: WorkOrderStatus.WAITING_PARTS },
        tone: 'warn' as const,
      },
      {
        key: 'waitingContractor',
        label: 'منتظرِ پیمانکار',
        count: waitingContractor,
        kind: 'workOrder' as const,
        filter: { status: WorkOrderStatus.WAITING_CONTRACTOR },
        tone: 'warn' as const,
      },
      {
        key: 'assetsDown',
        label: 'تجهیزِ از کار افتاده',
        count: assetsDown,
        kind: 'asset' as const,
        filter: { status: AssetStatus.OUT_OF_SERVICE },
        tone: 'danger' as const,
      },
    ];

    const [workload, recent, cost] = await Promise.all([
      this.technicianWorkload(organizationId, dep),
      this.recentActivity(organizationId, dep),
      this.costSummary(organizationId, dep),
    ]);

    return { buckets, workload, recent, cost, generatedAt: new Date() };
  }

  /**
   * بارِ کاریِ هر تکنسین: تعدادِ دستورِ کارِ بازِ منتسب به او.
   *
   * از جدولِ `work_order_technicians` با join می‌آید، نه از جست‌وجو در JSON؛
   * برای همین ایندکس‌پذیر و قابلِ اتکاست.
   */
  async technicianWorkload(organizationId: string, departmentId?: string) {
    const qb = this.technicians
      .createQueryBuilder('t')
      .innerJoin(WorkOrderEntity, 'w', 'w.id = t.workOrderId')
      .select('t.personnelId', 'personnelId')
      .addSelect('COUNT(t.id)', 'openCount')
      .where('w.organizationId = :org', { org: organizationId })
      .andWhere('w.status NOT IN (:...c)', { c: CLOSED_WORK_ORDER_STATUSES })
      .groupBy('t.personnelId')
      .orderBy('COUNT(t.id)', 'DESC')
      .limit(20);
    if (departmentId) {
      qb.andWhere('w.departmentId = :dep', { dep: departmentId });
    }
    const rows = await qb.getRawMany<{
      personnelId: string;
      openCount: string;
    }>();

    /*
     * نامِ پرسنل هم برمی‌گردد.
     *
     * بدونِ آن پنل شناسه‌ی خامِ UUID نشان می‌داد که برای مدیر بی‌معناست.
     * نام جداگانه خوانده می‌شود تا این کوئریِ تجمیعی ساده بماند.
     */
    const ids = rows.map((r) => r.personnelId);
    const names = new Map<string, string>();
    if (ids.length > 0) {
      const people = await this.personnel.find({
        where: { id: In(ids) },
        select: { id: true, fullName: true, position: true },
      });
      for (const p of people) {
        names.set(p.id, p.position ? `${p.fullName} — ${p.position}` : p.fullName);
      }
    }

    return rows.map((r) => ({
      personnelId: r.personnelId,
      name: names.get(r.personnelId) ?? 'نامشخص',
      openCount: Number(r.openCount),
    }));
  }

  /** آخرین رویدادهای بخشِ فنی برای ستونِ «فعالیتِ اخیر». */
  async recentActivity(organizationId: string, departmentId?: string) {
    const reqQb = this.requests
      .createQueryBuilder('r')
      .where('r.organizationId = :org', { org: organizationId })
      .orderBy('r.updatedAt', 'DESC')
      .take(8);
    const woQb = this.workOrders
      .createQueryBuilder('w')
      .where('w.organizationId = :org', { org: organizationId })
      .orderBy('w.updatedAt', 'DESC')
      .take(8);
    if (departmentId) {
      reqQb.andWhere('r.departmentId = :dep', { dep: departmentId });
      woQb.andWhere('w.departmentId = :dep', { dep: departmentId });
    }
    const [requests, orders] = await Promise.all([
      reqQb.getMany(),
      woQb.getMany(),
    ]);

    return [
      ...requests.map((r) => ({
        kind: 'request' as const,
        id: r.id,
        number: r.number,
        title: r.title,
        status: r.status as string,
        at: r.updatedAt,
      })),
      ...orders.map((w) => ({
        kind: 'workOrder' as const,
        id: w.id,
        number: w.number,
        title: w.title,
        status: w.status as string,
        at: w.updatedAt,
      })),
    ]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 10);
  }

  /** هزینهٔ نگهداری در ۳۰ روزِ گذشته (ریال). */
  async costSummary(organizationId: string, departmentId?: string) {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const qb = this.workOrders
      .createQueryBuilder('w')
      .select('COALESCE(SUM(w.internalCost), 0)', 'internal')
      .addSelect('COALESCE(SUM(w.contractorCost), 0)', 'contractor')
      .addSelect('COALESCE(SUM(w.laborMinutes), 0)', 'minutes')
      .where('w.organizationId = :org', { org: organizationId })
      .andWhere('w.createdAt >= :since', { since });
    if (departmentId) {
      qb.andWhere('w.departmentId = :dep', { dep: departmentId });
    }
    const row = await qb.getRawOne<{
      internal: string;
      contractor: string;
      minutes: string;
    }>();
    return {
      internal: Number(row?.internal ?? 0),
      contractor: Number(row?.contractor ?? 0),
      laborMinutes: Number(row?.minutes ?? 0),
      days: 30,
    };
  }

  /** وضعیتِ دارایی را همگام با کارِ باز نگه می‌دارد. */
  async setAssetStatus(
    organizationId: string,
    assetId: string,
    status: AssetStatus,
    actorId?: string,
  ) {
    const asset = await this.getAsset(organizationId, assetId);
    asset.status = status;
    const saved = await this.assets.save(asset);
    this.log(actorId, organizationId, 'asset.status', assetId, { status });
    return saved;
  }
}
