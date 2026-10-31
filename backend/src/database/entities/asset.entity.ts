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

/** اهمیتِ دارایی؛ مبنای اولویتِ خرابی و ترتیبِ کار. */
export enum AssetCriticality {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/** وضعیتِ بهره‌برداریِ دارایی. */
export enum AssetStatus {
  OPERATIONAL = 'operational',
  UNDER_MAINTENANCE = 'under_maintenance',
  OUT_OF_SERVICE = 'out_of_service',
  RETIRED = 'retired',
}

/** سند یا عکسِ پیوستِ دارایی. */
export interface AssetDocument {
  name: string;
  url: string;
  note?: string;
}

/**
 * شناسنامهٔ تجهیزات (CMMS).
 *
 * موجودیتِ اختصاصی است نه پاسخِ فرم: روی آن فیلتر، گزارش و تاریخچه لازم داریم
 * و وضعیت باید ستونِ ایندکس‌پذیر باشد. اتاق و بخش تکرار نمی‌شوند؛ فقط با
 * کلیدِ خارجی به `hotel_rooms` و `departments` وصل می‌شوند.
 */
@Entity('assets')
@Index('IDX_assets_org_status', ['organizationId', 'status'])
@Index('IDX_assets_org_code', ['organizationId', 'code'], { unique: true })
export class AssetEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: UUID_COLUMN })
  organizationId: string;

  /** کدِ دارایی؛ در هر سازمان یکتاست و روی برچسبِ تجهیز می‌رود. */
  @Column({ type: 'varchar', length: 40 })
  code: string;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'varchar', length: 80, default: '' })
  category: string;

  @Column({ type: 'varchar', length: 120, default: '' })
  manufacturer: string;

  @Column({ type: 'varchar', length: 120, default: '' })
  model: string;

  @Column({ type: 'varchar', length: 120, default: '' })
  serialNumber: string;

  /** محلِ متنی (وقتی اتاقِ ثبت‌شده‌ای ندارد؛ مثلِ موتورخانه). */
  @Column({ type: 'varchar', length: 160, default: '' })
  location: string;

  @Column({ type: 'varchar', length: 80, default: '' })
  building: string;

  @Column({ type: 'varchar', length: 40, default: '' })
  floor: string;

  /** اتاقِ مرتبط در `hotel_rooms`. */
  @Column({ type: UUID_COLUMN, nullable: true })
  roomId: string | null;

  /** بخشِ مسئولِ نگهداری. */
  @Column({ type: UUID_COLUMN, nullable: true })
  departmentId: string | null;

  /** دارایی والد؛ برای رابطهٔ پدر-فرزند (مثلاً چیلر → کمپرسور). */
  @Column({ type: UUID_COLUMN, nullable: true })
  parentId: string | null;

  /** تاریخِ نصب (ISO، میلادی؛ نمایش در UI شمسی است). */
  @Column({ type: 'varchar', length: 10, default: '' })
  installedAt: string;

  /** پایانِ گارانتی (ISO). */
  @Column({ type: 'varchar', length: 10, default: '' })
  warrantyUntil: string;

  @Column({
    type: ENUM_COLUMN,
    enum: AssetCriticality,
    default: AssetCriticality.MEDIUM,
  })
  criticality: AssetCriticality;

  @Column({
    type: ENUM_COLUMN,
    enum: AssetStatus,
    default: AssetStatus.OPERATIONAL,
  })
  status: AssetStatus;

  @Column({ type: JSON_COLUMN, default: '[]' })
  documents: AssetDocument[];

  @Column({ type: 'text', default: '' })
  notes: string;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  createdAt: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN })
  updatedAt: Date;
}
