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
  EntityManager,
  In,
  ObjectLiteral,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import {
  STOCK_DIRECTION,
  SparePartEntity,
  StockMovementEntity,
  StockMovementType,
} from '../database/entities/spare-part.entity';
import {
  WorkOrderEntity,
  WorkOrderStatus,
} from '../database/entities/work-order.entity';
import { AuditService } from '../common/audit.service';
import { LIKE_OPERATOR } from '../database/column-types';

/** دستورِ کارِ بسته دیگر قطعه نمی‌گیرد. */
const CLOSED_WORK_ORDER_STATUSES = [
  WorkOrderStatus.VERIFIED,
  WorkOrderStatus.CLOSED,
  WorkOrderStatus.CANCELLED,
];

const MAX_PAGE_SIZE = 200;

export interface PartInput {
  code?: string;
  name?: string;
  category?: string;
  unit?: string;
  reorderLevel?: number;
  unitCost?: number;
  location?: string;
  supplier?: string;
  notes?: string;
  isActive?: boolean;
  /** موجودیِ ابتدای کار؛ به‌شکلِ یک «ورود» در دفتر ثبت می‌شود. */
  openingQuantity?: number;
}

export interface MovementInput {
  partId: string;
  type: StockMovementType;
  quantity: number;
  unitCost?: number;
  workOrderId?: string | null;
  personnelId?: string | null;
  reference?: string;
  note?: string;
}

export interface PartListQuery {
  search?: string;
  category?: string;
  /** فقط قطعاتِ زیرِ نقطهٔ سفارش. */
  lowStock?: boolean | string;
  /** غیرفعال‌ها هم بیایند (پیش‌فرض: نه). */
  includeInactive?: boolean | string;
  page?: number;
  pageSize?: number;
}

export interface MovementListQuery {
  partId?: string;
  workOrderId?: string;
  type?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

const isTrue = (v: unknown) => v === true || v === 'true';

/**
 * انبارِ قطعاتِ فنی.
 *
 * دو قاعدهٔ محوری:
 *
 * ۱. **موجودی فقط از مسیرِ گردش عوض می‌شود.** `updatePart` ستونِ موجودی را
 *    نمی‌پذیرد؛ وگرنه دفترِ گردش و عددِ موجودی از هم جدا می‌افتادند و هیچ‌کدام
 *    قابلِ اتکا نمی‌ماند.
 * ۲. **موجودیِ منفی ممکن نیست.** مصرفِ بیشتر از موجودی رد می‌شود، چون انبارِ
 *    منفی یعنی یا شمارش غلط است یا قطعه بی‌ثبت رفته؛ هر دو باید دیده شوند،
 *    نه پنهان.
 */
@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(SparePartEntity)
    private readonly parts: Repository<SparePartEntity>,
    @InjectRepository(StockMovementEntity)
    private readonly movements: Repository<StockMovementEntity>,
    @InjectRepository(WorkOrderEntity)
    private readonly workOrders: Repository<WorkOrderEntity>,
    private readonly dataSource: DataSource,
    @Optional() private readonly audit?: AuditService,
  ) {}

  // ── قطعه ──────────────────────────────────────────────────────────────

  async listParts(organizationId: string, query: PartListQuery = {}) {
    const qb = this.parts
      .createQueryBuilder('p')
      .where('p.organizationId = :org', { org: organizationId });

    if (!isTrue(query.includeInactive)) {
      qb.andWhere('p.isActive = :active', { active: true });
    }
    if (query.category) {
      qb.andWhere('p.category = :cat', { cat: query.category });
    }
    if (isTrue(query.lowStock)) {
      // نقطهٔ سفارشِ صفر یعنی «هشدار نمی‌خواهم»، پس در این فهرست نمی‌آید.
      qb.andWhere('p.reorderLevel > 0').andWhere(
        'p.quantityOnHand <= p.reorderLevel',
      );
    }
    if (query.search) {
      const like = `%${query.search}%`;
      qb.andWhere(
        new Brackets((w) =>
          w
            .where(`p.name ${LIKE_OPERATOR} :like`, { like })
            .orWhere(`p.code ${LIKE_OPERATOR} :like`, { like })
            .orWhere(`p.supplier ${LIKE_OPERATOR} :like`, { like }),
        ),
      );
    }
    return this.paginate(qb, 'p.name', query, 'ASC');
  }

  async getPart(organizationId: string, id: string) {
    const part = await this.parts.findOne({ where: { id, organizationId } });
    if (!part) throw new NotFoundException('قطعه یافت نشد');
    return part;
  }

  async createPart(
    organizationId: string,
    input: PartInput,
    actorId?: string,
  ) {
    const code = (input.code ?? '').trim();
    const name = (input.name ?? '').trim();
    if (!code) throw new BadRequestException('کدِ انبار لازم است');
    if (!name) throw new BadRequestException('نامِ قطعه لازم است');

    const clash = await this.parts.findOne({
      where: { organizationId, code },
      select: { id: true },
    });
    if (clash) throw new BadRequestException('کدِ انبار تکراری است');

    const { openingQuantity = 0, ...rest } = input;
    const saved = await this.parts.save(
      this.parts.create({
        ...rest,
        code,
        name,
        organizationId,
        // موجودی از صفر شروع می‌شود؛ موجودیِ اولیه هم یک سطرِ دفتر می‌گیرد.
        quantityOnHand: 0,
      } as Partial<SparePartEntity>),
    );
    this.log(actorId, organizationId, 'part.create', saved.id, { code });

    if (Number(openingQuantity) > 0) {
      await this.move(
        organizationId,
        {
          partId: saved.id,
          type: StockMovementType.RECEIPT,
          quantity: Number(openingQuantity),
          unitCost: saved.unitCost,
          reference: 'موجودیِ اولیه',
        },
        actorId,
      );
      return this.getPart(organizationId, saved.id);
    }
    return saved;
  }

  /** ویرایشِ مشخصاتِ قطعه؛ موجودی از این مسیر عوض نمی‌شود. */
  async updatePart(
    organizationId: string,
    id: string,
    input: PartInput,
    actorId?: string,
  ) {
    const part = await this.getPart(organizationId, id);
    if (input.code !== undefined) {
      const code = input.code.trim();
      if (!code) throw new BadRequestException('کدِ انبار لازم است');
      if (code !== part.code) {
        const clash = await this.parts.findOne({
          where: { organizationId, code },
          select: { id: true },
        });
        if (clash) throw new BadRequestException('کدِ انبار تکراری است');
      }
      part.code = code;
    }

    /*
     * ستون‌هایی که از بدنه پذیرفته نمی‌شوند.
     *
     * `quantityOnHand` فقط با گردشِ انبار عوض می‌شود؛ اگر از اینجا هم
     * نوشتنی بود، کسی می‌توانست موجودی را دست‌کاری کند بدونِ اینکه سطری در
     * دفتر بماند.
     */
    const {
      code: _c,
      openingQuantity: _q,
      quantityOnHand: _h,
      organizationId: _o,
      id: _i,
      ...patch
    } = input as Record<string, never>;
    Object.assign(part, patch);

    const saved = await this.parts.save(part);
    this.log(actorId, organizationId, 'part.update', id, {});
    return saved;
  }

  // ── گردشِ انبار ───────────────────────────────────────────────────────

  /**
   * تنها مسیرِ تغییرِ موجودی.
   *
   * سطرِ دفتر، موجودیِ قطعه و (در مصرفِ روی دستورِ کار) هزینه و فهرستِ قطعاتِ
   * همان دستورِ کار، همه در یک تراکنش نوشته می‌شوند تا هیچ‌وقت نیمه‌کاره
   * نمانند.
   */
  async move(
    organizationId: string,
    input: MovementInput,
    actorId?: string,
  ): Promise<StockMovementEntity> {
    const quantity = Number(input.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new BadRequestException('تعداد باید عددِ صحیحِ مثبت باشد');
    }
    const direction = STOCK_DIRECTION[input.type];
    if (!direction) throw new BadRequestException('نوعِ گردش نامعتبر است');

    const part = await this.getPart(organizationId, input.partId);

    // دستورِ کار باید مالِ همین سازمان و هنوز باز باشد.
    let order: WorkOrderEntity | null = null;
    if (input.workOrderId) {
      order = await this.workOrders.findOne({
        where: { id: input.workOrderId, organizationId },
      });
      if (!order) throw new NotFoundException('دستورِ کار یافت نشد');
      if (CLOSED_WORK_ORDER_STATUSES.includes(order.status)) {
        throw new BadRequestException(
          'دستورِ کارِ بسته‌شده قطعهٔ تازه نمی‌گیرد',
        );
      }
    }

    const unitCost = Number(input.unitCost ?? part.unitCost ?? 0);
    if (unitCost < 0) throw new BadRequestException('قیمت نمی‌تواند منفی باشد');
    const totalCost = unitCost * quantity;
    const balanceAfter = part.quantityOnHand + direction * quantity;
    if (balanceAfter < 0) {
      throw new BadRequestException(
        `موجودیِ «${part.name}» ${part.quantityOnHand} ${part.unit} است؛ بیشتر از آن خارج نمی‌شود`,
      );
    }

    const saved = await this.dataSource.transaction(async (manager) => {
      const movement = await manager.save(
        manager.create(StockMovementEntity, {
          organizationId,
          partId: part.id,
          type: input.type,
          quantity,
          unitCost,
          totalCost,
          balanceAfter,
          workOrderId: input.workOrderId ?? null,
          personnelId: input.personnelId ?? null,
          reference: input.reference ?? '',
          note: input.note ?? '',
          byUserId: actorId ?? null,
        }),
      );

      part.quantityOnHand = balanceAfter;
      /*
       * ورودِ خرید، قیمتِ واحد را به میانگینِ موزون می‌برد.
       *
       * نه آخرین قیمت: اگر یک فاکتورِ گرانِ کوچک بیاید، ارزشِ کلِ انبار
       * بی‌دلیل بالا می‌رفت. میانگینِ موزون ارزش را به واقعیتِ پرداختی
       * نزدیک نگه می‌دارد.
       */
      if (input.type === StockMovementType.RECEIPT && unitCost > 0) {
        const before = balanceAfter - quantity;
        part.unitCost = Math.round(
          (before * part.unitCost + quantity * unitCost) / balanceAfter,
        );
      }
      await manager.save(part);

      if (order) {
        await this.applyToWorkOrder(
          manager,
          order,
          part,
          input.type,
          quantity,
          totalCost,
        );
      }

      return movement;
    });

    this.log(actorId, organizationId, 'stock.move', saved.id, {
      partId: part.id,
      type: input.type,
      quantity,
      balanceAfter,
    });
    return saved;
  }

  /**
   * اثرِ مصرف/برگشت روی خودِ دستورِ کار.
   *
   * قطعه در `parts` و هزینه در `internalCost` می‌نشیند، پس گزارشِ هزینهٔ
   * عملیات بدونِ کارِ دستیِ اضافه درست می‌ماند. برگشت هم همان‌جا کم می‌شود،
   * وگرنه هزینهٔ کار متورم باقی می‌ماند.
   */
  private async applyToWorkOrder(
    manager: EntityManager,
    order: WorkOrderEntity,
    part: SparePartEntity,
    type: StockMovementType,
    quantity: number,
    totalCost: number,
  ) {
    const outbound = type === StockMovementType.ISSUE;
    const inbound = type === StockMovementType.RETURN;
    if (!outbound && !inbound) return;

    const lines = [...(order.parts ?? [])];
    const at = lines.findIndex((l) => l.partId === part.id);
    const delta = outbound ? quantity : -quantity;

    if (at >= 0) {
      const next = lines[at].quantity + delta;
      if (next > 0) lines[at] = { ...lines[at], quantity: next };
      else lines.splice(at, 1);
    } else if (outbound) {
      lines.push({
        partId: part.id,
        name: `${part.code} — ${part.name}`,
        quantity,
        unitCost: totalCost / quantity,
      });
    }

    order.parts = lines;
    // هزینه زیرِ صفر نمی‌رود، حتی اگر برگشت بیشتر از مصرفِ ثبت‌شده باشد.
    order.internalCost = Math.max(
      0,
      order.internalCost + (outbound ? totalCost : -totalCost),
    );
    await manager.save(order);
  }

  /**
   * اصلاحِ شمارشِ انبار.
   *
   * اختلافِ شمارشِ واقعی با موجودیِ ثبت‌شده را به‌شکلِ یک گردشِ اصلاحی ثبت
   * می‌کند؛ موجودی هرگز بی‌سند عوض نمی‌شود. اگر برابر بودند، چیزی نوشته
   * نمی‌شود.
   */
  async recount(
    organizationId: string,
    partId: string,
    countedQuantity: number,
    note = '',
    actorId?: string,
  ) {
    const counted = Number(countedQuantity);
    if (!Number.isInteger(counted) || counted < 0) {
      throw new BadRequestException('شمارش باید عددِ صحیحِ غیرمنفی باشد');
    }
    const part = await this.getPart(organizationId, partId);
    const diff = counted - part.quantityOnHand;
    if (diff === 0) return { movement: null, part };

    const movement = await this.move(
      organizationId,
      {
        partId,
        type: diff > 0 ? StockMovementType.ADJUST_IN : StockMovementType.ADJUST_OUT,
        quantity: Math.abs(diff),
        unitCost: part.unitCost,
        reference: 'انبارگردانی',
        note,
      },
      actorId,
    );
    return { movement, part: await this.getPart(organizationId, partId) };
  }

  /** دفترِ گردش، با نامِ قطعه روی هر سطر. */
  async listMovements(organizationId: string, query: MovementListQuery = {}) {
    const qb = this.movements
      .createQueryBuilder('m')
      .where('m.organizationId = :org', { org: organizationId });

    if (query.partId) qb.andWhere('m.partId = :p', { p: query.partId });
    if (query.workOrderId) {
      qb.andWhere('m.workOrderId = :w', { w: query.workOrderId });
    }
    if (query.type) qb.andWhere('m.type = :t', { t: query.type });
    if (query.from) {
      qb.andWhere('m.createdAt >= :from', { from: new Date(query.from) });
    }
    if (query.to) {
      qb.andWhere('m.createdAt <= :to', { to: new Date(query.to) });
    }

    const page = await this.paginate(qb, 'm.createdAt', query, 'DESC');

    /*
     * نامِ قطعه هم برمی‌گردد.
     *
     * بدونِ آن، دفترِ گردش ستونی از UUID می‌شد که برای انباردار بی‌معناست.
     */
    const ids = [...new Set(page.rows.map((m) => m.partId))];
    const names = new Map<string, { code: string; name: string; unit: string }>();
    if (ids.length > 0) {
      const rows = await this.parts.find({
        where: { id: In(ids) },
        select: { id: true, code: true, name: true, unit: true },
      });
      for (const p of rows) {
        names.set(p.id, { code: p.code, name: p.name, unit: p.unit });
      }
    }

    return {
      ...page,
      rows: page.rows.map((m) => ({
        ...m,
        partCode: names.get(m.partId)?.code ?? '',
        partName: names.get(m.partId)?.name ?? 'نامشخص',
        partUnit: names.get(m.partId)?.unit ?? '',
      })),
    };
  }

  /** قطعاتی که باید سفارش داد. */
  lowStockParts(organizationId: string) {
    return this.parts
      .createQueryBuilder('p')
      .where('p.organizationId = :org', { org: organizationId })
      .andWhere('p.isActive = :active', { active: true })
      .andWhere('p.reorderLevel > 0')
      .andWhere('p.quantityOnHand <= p.reorderLevel')
      .orderBy('p.quantityOnHand', 'ASC')
      .limit(50)
      .getMany();
  }

  /**
   * خلاصهٔ انبار برای داشبوردِ فنی.
   *
   * سطل‌ها `filter` خودشان را دارند تا عدد روی داشبورد به همان فهرست
   * drill-down شود، مثلِ بقیهٔ سطل‌های عملیاتی.
   */
  async summary(organizationId: string) {
    const [low, out, valuation, consumption] = await Promise.all([
      this.parts
        .createQueryBuilder('p')
        .where('p.organizationId = :org', { org: organizationId })
        .andWhere('p.isActive = :active', { active: true })
        .andWhere('p.reorderLevel > 0')
        .andWhere('p.quantityOnHand <= p.reorderLevel')
        .getCount(),
      this.parts.count({
        where: { organizationId, isActive: true, quantityOnHand: 0 },
      }),
      this.parts
        .createQueryBuilder('p')
        .select(
          'COALESCE(SUM(p.quantityOnHand * p.unitCost), 0)',
          'value',
        )
        .where('p.organizationId = :org', { org: organizationId })
        .andWhere('p.isActive = :active', { active: true })
        .getRawOne<{ value: string }>(),
      this.movements
        .createQueryBuilder('m')
        .select('COALESCE(SUM(m.totalCost), 0)', 'cost')
        .addSelect('COALESCE(SUM(m.quantity), 0)', 'qty')
        .where('m.organizationId = :org', { org: organizationId })
        .andWhere('m.type = :t', { t: StockMovementType.ISSUE })
        .andWhere('m.createdAt >= :since', {
          since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        })
        .getRawOne<{ cost: string; qty: string }>(),
    ]);

    return {
      buckets: [
        {
          key: 'lowStock',
          label: 'زیرِ نقطهٔ سفارش',
          count: low,
          kind: 'part' as const,
          filter: { lowStock: true },
          tone: 'warn' as const,
        },
        {
          key: 'outOfStock',
          label: 'موجودیِ صفر',
          count: out,
          kind: 'part' as const,
          filter: { lowStock: true },
          tone: 'danger' as const,
        },
      ],
      valuation: Number(valuation?.value ?? 0),
      consumption: {
        cost: Number(consumption?.cost ?? 0),
        quantity: Number(consumption?.qty ?? 0),
        days: 30,
      },
    };
  }

  // ── کمک‌ها ────────────────────────────────────────────────────────────

  private async paginate<T extends ObjectLiteral>(
    qb: SelectQueryBuilder<T>,
    orderField: string,
    query: { page?: number; pageSize?: number },
    direction: 'ASC' | 'DESC' = 'DESC',
  ) {
    const pageSize = Math.min(
      Math.max(Number(query.pageSize ?? 25), 1),
      MAX_PAGE_SIZE,
    );
    const page = Math.max(Number(query.page ?? 1), 1);
    qb.orderBy(orderField, direction)
      .skip((page - 1) * pageSize)
      .take(pageSize);
    const [rows, total] = await qb.getManyAndCount();
    return { rows, total, page, pageSize };
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
        actorType: actorId ? 'user' : 'system',
        actorId: actorId ?? null,
        payload: { entityId, ...meta },
      })
      .catch(() => undefined);
  }
}
