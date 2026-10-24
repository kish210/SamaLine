import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ENUM_COLUMN, JSON_COLUMN, TIMESTAMP_COLUMN, UUID_COLUMN } from '../column-types';

/** دسته‌بندی درخواست تعمیرات (بخش فنی هتل). */
export enum MaintenanceCategory {
  ELECTRICAL = 'electrical',
  PLUMBING = 'plumbing',
  HVAC = 'hvac',
  CARPENTRY = 'carpentry',
  PAINTING = 'painting',
  FURNITURE = 'furniture',
  /** شبکه/تلفن/تلویزیون — فقط به‌عنوان دسته‌ی تیکت، نه مانیتورینگ شبکه. */
  NETWORK_PHONE_TV = 'network_phone_tv',
  LOCKS_ACCESS = 'locks_access',
  OTHER = 'other',
}

export enum MaintenancePriority {
  NORMAL = 'normal',
  URGENT = 'urgent',
  EMERGENCY = 'emergency',
}

/**
 * چرخه‌ی وضعیت درخواست. مستقل از «آماده‌بودن اتاق» است: بسته‌شدن تیکت به‌خودی‌خود
 * اتاق را آماده نمی‌کند (RoomReadinessEntity).
 */
export enum MaintenanceStatus {
  NEW = 'new',
  IN_PROGRESS = 'in_progress',
  WAITING_PART = 'waiting_part',
  CONTRACTOR_REQUIRED = 'contractor_required',
  FOLLOW_UP = 'follow_up',
  DONE = 'done',
  CANCELLED = 'cancelled',
}

/**
 * درخواست تعمیر و نگهداری هتل.
 *
 * به فضای کاری (هر هتل = یک فضای کاری) تعلق دارد. حذف سخت نمی‌شود؛ به‌جای آن
 * `archivedAt` پر می‌شود تا تاریخچه‌ی عملیاتی حفظ شود.
 */
@Entity('maintenance_requests')
@Index('IDX_maintenance_ws_status', ['workspaceId', 'status'])
@Index('IDX_maintenance_ws_no', ['workspaceId', 'requestNo'], { unique: true })
export class MaintenanceRequestEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: UUID_COLUMN })
  workspaceId: string;

  /** شماره‌ی خوانا و یکتا در هر فضای کاری (مثل «۱۰۲۳»). */
  @Column({ type: 'varchar', length: 40 })
  requestNo: string;

  /** کاربر ثبت‌کننده (از توکن)؛ ممکن است بعداً حذف شده باشد. */
  @Column({ type: UUID_COLUMN, nullable: true })
  createdByUserId: string | null;

  @Column({ type: 'varchar', length: 160, default: '' })
  requesterName: string;

  @Column({ type: 'varchar', length: 120, default: '' })
  building: string;

  @Column({ type: 'varchar', length: 120, default: '' })
  floor: string;

  @Column({ type: 'varchar', length: 120, default: '' })
  room: string;

  /** توضیح مکان/دارایی برای جایی که اتاق/طبقه کافی نیست. */
  @Column({ type: 'varchar', length: 300, default: '' })
  locationNote: string;

  @Column({ type: ENUM_COLUMN, enum: MaintenanceCategory, default: MaintenanceCategory.OTHER })
  category: MaintenanceCategory;

  @Column({ type: 'text', default: '' })
  description: string;

  @Column({ type: ENUM_COLUMN, enum: MaintenancePriority, default: MaintenancePriority.NORMAL })
  priority: MaintenancePriority;

  /** فنی‌کار یا تیم مسئول (نام آزاد؛ تیم نگهداری لزوماً کاربر پنل نیست). */
  @Column({ type: 'varchar', length: 160, default: '' })
  assignedTo: string;

  @Column({ type: ENUM_COLUMN, enum: MaintenanceStatus, default: MaintenanceStatus.NEW })
  status: MaintenanceStatus;

  @Column({ type: 'text', default: '' })
  workNotes: string;

  @Column({ type: 'text', default: '' })
  completionNotes: string;

  /** هزینه‌ها به کوچک‌ترین واحد پول (مثل ریال)؛ bigint برای جلوگیری از سرریز. */
  @Column({ type: 'bigint', default: 0 })
  estimatedCost: string;

  @Column({ type: 'bigint', default: 0 })
  actualCost: string;

  /** ضمیمه‌ها: [{ url, name }] از مسیر امن آپلودِ موجود. */
  @Column({ type: JSON_COLUMN, default: [] })
  attachments: Array<{ url: string; name: string }>;

  @Column({ type: TIMESTAMP_COLUMN, nullable: true })
  closedAt: Date | null;

  /** حذف نرم: به‌جای حذف سخت، بایگانی می‌شود تا تاریخچه بماند. */
  @Column({ type: TIMESTAMP_COLUMN, nullable: true })
  archivedAt: Date | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  createdAt: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN })
  updatedAt: Date;
}
