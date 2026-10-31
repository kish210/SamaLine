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
import { MaintenanceCategory } from './maintenance-request.entity';

/** دوره‌ی تکرارِ نگهداریِ پیشگیرانه. */
export enum PmInterval {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  ANNUAL = 'annual',
  /** فاصله‌ی دلخواه بر حسبِ روز (`intervalDays`). */
  CUSTOM = 'custom',
}

/** طولِ هر دوره بر حسبِ روز؛ `custom` از ستونِ خودش می‌خواند. */
export const PM_INTERVAL_DAYS: Record<Exclude<PmInterval, PmInterval.CUSTOM>, number> =
  {
    [PmInterval.DAILY]: 1,
    [PmInterval.WEEKLY]: 7,
    [PmInterval.MONTHLY]: 30,
    [PmInterval.QUARTERLY]: 91,
    [PmInterval.ANNUAL]: 365,
  };

/**
 * برنامهٔ نگهداریِ پیشگیرانه (CMMS).
 *
 * فقط تقویم نیست: هر بار که موعد می‌رسد، سامانه خودش دستورِ کار می‌سازد و
 * موعدِ بعدی را جلو می‌برد. بدونِ این، «نگهداریِ پیشگیرانه» صرفاً یادداشتی
 * می‌شد که کسی اجرایش نمی‌کند.
 */
@Entity('pm_schedules')
@Index('IDX_pm_org_active', ['organizationId', 'isActive'])
@Index('IDX_pm_next_due', ['nextDueAt'])
export class PmScheduleEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: UUID_COLUMN })
  organizationId: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  /** تجهیزِ موضوعِ نگهداری. */
  @Column({ type: UUID_COLUMN, nullable: true })
  assetId: string | null;

  @Column({ type: UUID_COLUMN, nullable: true })
  roomId: string | null;

  @Column({ type: UUID_COLUMN, nullable: true })
  departmentId: string | null;

  @Column({
    type: ENUM_COLUMN,
    enum: MaintenanceCategory,
    default: MaintenanceCategory.OTHER,
  })
  category: MaintenanceCategory;

  @Column({ type: ENUM_COLUMN, enum: PmInterval, default: PmInterval.MONTHLY })
  interval: PmInterval;

  /** فقط برای دوره‌ی دلخواه. */
  @Column({ type: 'int', default: 0 })
  intervalDays: number;

  /** چک‌لیستی که روی دستورِ کارِ تولیدشده کپی می‌شود. */
  @Column({ type: JSON_COLUMN, default: '[]' })
  checklist: Array<{ text: string; done: boolean }>;

  /** تکنسین‌های پیش‌فرضِ این برنامه. */
  @Column({ type: JSON_COLUMN, default: '[]' })
  technicianIds: string[];

  @Column({ type: 'text', default: '' })
  instructions: string;

  /** موعدِ بعدی (ISO تاریخ)؛ مبنای «سررسیده». */
  @Column({ type: 'varchar', length: 10 })
  nextDueAt: string;

  /** آخرین باری که از روی این برنامه دستورِ کار ساخته شد. */
  @Column({ type: TIMESTAMP_COLUMN, nullable: true })
  lastGeneratedAt: Date | null;

  /** دستورِ کارِ ساخته‌شده‌ی آخر؛ برای پیگیری. */
  @Column({ type: UUID_COLUMN, nullable: true })
  lastWorkOrderId: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  createdAt: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN })
  updatedAt: Date;
}
