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

/** دسته‌بندیِ کارِ فنی. */
export enum MaintenanceCategory {
  ELECTRICAL = 'electrical',
  PLUMBING = 'plumbing',
  HVAC = 'hvac',
  CARPENTRY = 'carpentry',
  PAINTING = 'painting',
  FURNITURE = 'furniture',
  NETWORK = 'network',
  DOOR_LOCK = 'door_lock',
  OTHER = 'other',
}

export enum MaintenancePriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  EMERGENCY = 'emergency',
}

/**
 * وضعیتِ درخواست.
 *
 * ستونِ enum است نه JSON، چون داشبوردِ عملیاتی روی همین فیلتر و می‌شمارد
 * («جدید»، «معوق»، «منتظرِ قطعه») و باید ایندکس‌پذیر باشد.
 */
export enum MaintenanceRequestStatus {
  NEW = 'new',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  ASSIGNED = 'assigned',
  IN_PROGRESS = 'in_progress',
  WAITING_PARTS = 'waiting_parts',
  WAITING_CONTRACTOR = 'waiting_contractor',
  FOLLOW_UP = 'follow_up',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
  CLOSED = 'closed',
}

/** یک گامِ تاریخچهٔ وضعیت. */
export interface RequestHistoryStep {
  at: string;
  from: string;
  to: string;
  byUserId?: string | null;
  note?: string;
}

/**
 * درخواستِ تعمیر (CMMS).
 *
 * جایگزینِ ثبتِ درخواست به‌شکلِ «پاسخِ فرم» است: آنجا وضعیت داخلِ
 * `meta.review` (JSON) می‌نشست و نه فیلترِ درست می‌داد نه گزارشِ درست.
 */
@Entity('maintenance_requests')
@Index('IDX_maint_req_org_status', ['organizationId', 'status'])
@Index('IDX_maint_req_org_number', ['organizationId', 'number'], {
  unique: true,
})
export class MaintenanceRequestEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: UUID_COLUMN })
  organizationId: string;

  /** شمارهٔ خوانا و خودکار در هر سازمان (مثلِ ۱۴۰۴-۰۰۱۲). */
  @Column({ type: 'varchar', length: 24 })
  number: string;

  /** کاربرِ ثبت‌کننده (اگر از پنل آمده باشد). */
  @Column({ type: UUID_COLUMN, nullable: true })
  requestedByUserId: string | null;

  /** پرسنلِ ثبت‌کننده (اگر از ربات/پرتال آمده باشد). */
  @Column({ type: UUID_COLUMN, nullable: true })
  requestedByPersonnelId: string | null;

  /** بخشِ درخواست‌دهنده. */
  @Column({ type: UUID_COLUMN, nullable: true })
  departmentId: string | null;

  @Column({ type: UUID_COLUMN, nullable: true })
  roomId: string | null;

  @Column({ type: UUID_COLUMN, nullable: true })
  assetId: string | null;

  @Column({ type: 'varchar', length: 160, default: '' })
  location: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text', default: '' })
  description: string;

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
    enum: MaintenanceRequestStatus,
    default: MaintenanceRequestStatus.NEW,
  })
  status: MaintenanceRequestStatus;

  /** عکس‌ها و پیوست‌ها. */
  @Column({ type: JSON_COLUMN, default: '[]' })
  attachments: Array<{ name: string; url: string }>;

  /** تأثیرِ عملیاتی (مثلاً «اتاق غیرقابل‌فروش»). */
  @Column({ type: 'varchar', length: 200, default: '' })
  operationalImpact: string;

  /** آیا به مهمان مربوط است؟ برای گزارشِ حوادثِ مهمان. */
  @Column({ type: 'boolean', default: false })
  guestRelated: boolean;

  /** موعدِ خواسته‌شده (ISO). */
  @Column({ type: 'varchar', length: 10, default: '' })
  dueDate: string;

  @Column({ type: 'text', default: '' })
  rejectionReason: string;

  /** تاریخچهٔ گذارِ وضعیت. */
  @Column({ type: JSON_COLUMN, default: '[]' })
  history: RequestHistoryStep[];

  @Column({ type: TIMESTAMP_COLUMN, nullable: true })
  completedAt: Date | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  createdAt: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN })
  updatedAt: Date;
}
