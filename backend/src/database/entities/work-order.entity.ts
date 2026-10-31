import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  ENUM_COLUMN,
  JSON_COLUMN,
  TIMESTAMP_COLUMN,
  UUID_COLUMN,
} from '../column-types';
import {
  MaintenanceCategory,
  MaintenancePriority,
  RequestHistoryStep,
} from './maintenance-request.entity';

/** وضعیتِ دستورِ کار. */
export enum WorkOrderStatus {
  DRAFT = 'draft',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  WAITING_PARTS = 'waiting_parts',
  WAITING_CONTRACTOR = 'waiting_contractor',
  COMPLETED = 'completed',
  VERIFIED = 'verified',
  CLOSED = 'closed',
  CANCELLED = 'cancelled',
}

/** قطعهٔ مصرف‌شده روی دستورِ کار. */
export interface WorkOrderPart {
  name: string;
  quantity: number;
  unitCost?: number;
  partId?: string | null;
}

/**
 * دستورِ کارِ فنی (CMMS).
 *
 * از درخواست زاده می‌شود یا مستقیم (مثلاً نگهداریِ پیشگیرانه). تکنسین‌ها در
 * جدولِ جدا (`work_order_technicians`) می‌نشینند تا چند نفر روی یک کار ممکن
 * باشد و بارِ کاریِ هر تکنسین قابلِ گزارش بماند.
 */
@Entity('work_orders')
@Index('IDX_work_orders_org_status', ['organizationId', 'status'])
@Index('IDX_work_orders_org_number', ['organizationId', 'number'], {
  unique: true,
})
export class WorkOrderEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: UUID_COLUMN })
  organizationId: string;

  @Column({ type: 'varchar', length: 24 })
  number: string;

  /** درخواستِ مبدأ؛ null یعنی دستورِ کارِ مستقل. */
  @Column({ type: UUID_COLUMN, nullable: true })
  requestId: string | null;

  @Column({ type: UUID_COLUMN, nullable: true })
  assetId: string | null;

  @Column({ type: UUID_COLUMN, nullable: true })
  roomId: string | null;

  @Column({ type: UUID_COLUMN, nullable: true })
  departmentId: string | null;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({
    type: ENUM_COLUMN,
    enum: MaintenanceCategory,
    default: MaintenanceCategory.OTHER,
  })
  category: MaintenanceCategory;

  @Column({
    type: ENUM_COLUMN,
    enum: MaintenancePriority,
    default: MaintenancePriority.NORMAL,
  })
  priority: MaintenancePriority;

  @Column({
    type: ENUM_COLUMN,
    enum: WorkOrderStatus,
    default: WorkOrderStatus.DRAFT,
  })
  status: WorkOrderStatus;

  @Column({ type: 'text', default: '' })
  diagnosis: string;

  @Column({ type: 'text', default: '' })
  rootCause: string;

  @Column({ type: 'text', default: '' })
  workDescription: string;

  @Column({ type: 'text', default: '' })
  workPerformed: string;

  @Column({ type: 'text', default: '' })
  technicianNotes: string;

  /** قطعاتِ مصرفی. */
  @Column({ type: JSON_COLUMN, default: '[]' })
  parts: WorkOrderPart[];

  /** دقیقهٔ کارِ ثبت‌شده. */
  @Column({ type: 'int', default: 0 })
  laborMinutes: number;

  /** هزینهٔ داخلی (ریال). */
  @Column({ type: 'int', default: 0 })
  internalCost: number;

  /** هزینهٔ پیمانکار (ریال). */
  @Column({ type: 'int', default: 0 })
  contractorCost: number;

  /** عکس‌های پیش و پس از کار. */
  @Column({ type: JSON_COLUMN, default: '[]' })
  attachments: Array<{ name: string; url: string; phase?: 'before' | 'after' }>;

  /** چک‌لیستِ تکمیل. */
  @Column({ type: JSON_COLUMN, default: '[]' })
  checklist: Array<{ text: string; done: boolean }>;

  @Column({ type: TIMESTAMP_COLUMN, nullable: true })
  startedAt: Date | null;

  @Column({ type: TIMESTAMP_COLUMN, nullable: true })
  completedAt: Date | null;

  /** تأییدِ مدیر پس از تکمیل. */
  @Column({ type: UUID_COLUMN, nullable: true })
  verifiedByUserId: string | null;

  @Column({ type: TIMESTAMP_COLUMN, nullable: true })
  verifiedAt: Date | null;

  /** موعدِ انجام (ISO)؛ مبنای «معوق». */
  @Column({ type: 'varchar', length: 10, default: '' })
  dueDate: string;

  @Column({ type: JSON_COLUMN, default: '[]' })
  history: RequestHistoryStep[];

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  createdAt: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN })
  updatedAt: Date;
}

/**
 * تکنسینِ منتسب به دستورِ کار.
 *
 * جدولِ جدا (نه آرایهٔ JSON) چون «کارهای من» و «بارِ کاریِ تکنسین» باید با
 * join و ایندکس پرسیده شوند، نه با جست‌وجوی متنی داخلِ JSON.
 */
@Entity('work_order_technicians')
@Index('IDX_wo_tech_order', ['workOrderId'])
@Index('IDX_wo_tech_person', ['personnelId'])
export class WorkOrderTechnicianEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: UUID_COLUMN })
  workOrderId: string;

  /** تکنسین از دفترچهٔ پرسنل. */
  @Column({ type: UUID_COLUMN })
  personnelId: string;

  /** نفرِ اصلی؛ برای نمایش در فهرست. */
  @Column({ type: 'boolean', default: false })
  isPrimary: boolean;

  /** دقیقهٔ کارِ همین تکنسین. */
  @Column({ type: 'int', default: 0 })
  laborMinutes: number;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  createdAt: Date;
}
