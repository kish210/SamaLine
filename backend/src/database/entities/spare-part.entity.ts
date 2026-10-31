import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ENUM_COLUMN, TIMESTAMP_COLUMN, UUID_COLUMN } from '../column-types';

/**
 * قطعهٔ یدکی/کالای انبارِ فنی.
 *
 * `quantityOnHand` ستونِ معتبرِ موجودی است و فقط از مسیرِ گردشِ انبار عوض
 * می‌شود (نه با نوشتنِ مستقیم)، تا دفترِ گردش و موجودی هیچ‌وقت از هم جدا
 * نیفتند.
 */
@Entity('spare_parts')
@Index('IDX_spare_parts_org_code', ['organizationId', 'code'], { unique: true })
@Index('IDX_spare_parts_org_active', ['organizationId', 'isActive'])
export class SparePartEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: UUID_COLUMN })
  organizationId: string;

  /** کدِ انبار؛ در هر سازمان یکتاست. */
  @Column({ type: 'varchar', length: 40 })
  code: string;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'varchar', length: 80, default: '' })
  category: string;

  /** واحدِ شمارش: عدد، متر، لیتر… */
  @Column({ type: 'varchar', length: 24, default: 'عدد' })
  unit: string;

  /** موجودیِ فعلی؛ فقط گردشِ انبار آن را عوض می‌کند. */
  @Column({ type: 'int', default: 0 })
  quantityOnHand: number;

  /**
   * نقطهٔ سفارش.
   *
   * موجودیِ کمتر یا مساویِ این عدد یعنی «باید سفارش داد»؛ مبنای هشدارِ
   * داشبورد. صفر یعنی هشداری لازم نیست.
   */
  @Column({ type: 'int', default: 0 })
  reorderLevel: number;

  /** قیمتِ واحدِ جاری (ریال)؛ مبنای ارزشِ انبار و هزینهٔ مصرف. */
  @Column({ type: 'int', default: 0 })
  unitCost: number;

  /** جای نگهداری: انبار، قفسه، ردیف. */
  @Column({ type: 'varchar', length: 160, default: '' })
  location: string;

  @Column({ type: 'varchar', length: 160, default: '' })
  supplier: string;

  @Column({ type: 'text', default: '' })
  notes: string;

  /**
   * قطعهٔ بازنشسته.
   *
   * حذف نمی‌کنیم؛ دفترِ گردشِ گذشته باید خوانا بماند، پس قطعه غیرفعال
   * می‌شود و از فهرست‌های انتخاب بیرون می‌رود.
   */
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  createdAt: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN })
  updatedAt: Date;
}

/**
 * نوعِ گردشِ انبار.
 *
 * جهتِ تغییرِ موجودی از نوع می‌آید، نه از علامتِ تعداد؛ پس تعداد همیشه مثبت
 * است و گزارش «چقدر وارد شد / چقدر مصرف شد» بی‌ابهام می‌ماند. اصلاحِ شمارش
 * هم دو نوعِ جدا دارد تا همین قاعده نشکند.
 */
export enum StockMovementType {
  /** ورودِ خرید یا تحویل از تأمین‌کننده. */
  RECEIPT = 'receipt',
  /** خروج برای مصرف (معمولاً روی یک دستورِ کار). */
  ISSUE = 'issue',
  /** برگشتِ قطعهٔ مصرف‌نشده به انبار. */
  RETURN = 'return',
  /** ضایعات/خرابیِ قطعه. */
  SCRAP = 'scrap',
  /** اصلاحِ شمارش، رو به بالا. */
  ADJUST_IN = 'adjust_in',
  /** اصلاحِ شمارش، رو به پایین. */
  ADJUST_OUT = 'adjust_out',
}

/** هر نوعِ گردش موجودی را چند واحد جابه‌جا می‌کند. */
export const STOCK_DIRECTION: Record<StockMovementType, 1 | -1> = {
  [StockMovementType.RECEIPT]: 1,
  [StockMovementType.RETURN]: 1,
  [StockMovementType.ADJUST_IN]: 1,
  [StockMovementType.ISSUE]: -1,
  [StockMovementType.SCRAP]: -1,
  [StockMovementType.ADJUST_OUT]: -1,
};

/**
 * دفترِ گردشِ انبار: هر ورود و خروج یک سطرِ تغییرناپذیر.
 *
 * `balanceAfter` روی خودِ سطر می‌نشیند تا تاریخچه بدونِ بازپخشِ کلِ دفتر
 * خوانده شود و اگر موجودی مشکوک شد، بتوان نقطهٔ انحراف را دید.
 */
@Entity('stock_movements')
@Index('IDX_stock_mov_org_part', ['organizationId', 'partId', 'createdAt'])
@Index('IDX_stock_mov_order', ['workOrderId'])
export class StockMovementEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: UUID_COLUMN })
  organizationId: string;

  @Column({ type: UUID_COLUMN })
  partId: string;

  @Column({ type: ENUM_COLUMN, enum: StockMovementType })
  type: StockMovementType;

  /** همیشه مثبت؛ جهت از `type` می‌آید. */
  @Column({ type: 'int' })
  quantity: number;

  /** قیمتِ واحد در همین گردش؛ قیمتِ تاریخی حفظ می‌شود. */
  @Column({ type: 'int', default: 0 })
  unitCost: number;

  /** تعداد × قیمتِ واحد، همان لحظه حساب شده. */
  @Column({ type: 'int', default: 0 })
  totalCost: number;

  /** موجودی پس از این گردش. */
  @Column({ type: 'int', default: 0 })
  balanceAfter: number;

  /** مصرف روی کدام دستورِ کار؛ null یعنی گردشِ انباریِ ساده. */
  @Column({ type: UUID_COLUMN, nullable: true })
  workOrderId: string | null;

  /** تحویل به کدام پرسنل. */
  @Column({ type: UUID_COLUMN, nullable: true })
  personnelId: string | null;

  /** شمارهٔ فاکتور، حواله یا سندِ مرجع. */
  @Column({ type: 'varchar', length: 80, default: '' })
  reference: string;

  @Column({ type: 'varchar', length: 300, default: '' })
  note: string;

  @Column({ type: UUID_COLUMN, nullable: true })
  byUserId: string | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  createdAt: Date;
}
