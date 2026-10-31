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

/** نوعِ مرخصی یا غیبتِ موجه. */
export enum LeaveType {
  ANNUAL = 'annual',
  SICK = 'sick',
  UNPAID = 'unpaid',
  MISSION = 'mission',
  HOURLY = 'hourly',
  OTHER = 'other',
}

/**
 * وضعیتِ درخواستِ مرخصی.
 *
 * ستونِ enum است نه JSON: کارتابلِ تأیید و گزارشِ HR روی همین فیلتر می‌کنند.
 * پیش از این درخواست‌ها پاسخِ نظرسنجی بودند و وضعیت داخلِ `meta.review`
 * می‌نشست که نه ایندکس‌پذیر بود نه قابلِ اتکا.
 */
export enum LeaveStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

/** یک گامِ تاریخچهٔ تصمیم. */
export interface LeaveHistoryStep {
  at: string;
  from: string;
  to: string;
  byUserId?: string | null;
  note?: string;
}

/**
 * درخواستِ مرخصی (دامنهٔ HR).
 *
 * موجودیتِ اختصاصی است تا ماندهٔ مرخصی، تقویمِ غیبت و گزارش‌های HR از روی
 * ستون‌های واقعی ساخته شوند، نه از جست‌وجو در پاسخ‌های فرم.
 */
@Entity('leave_requests')
@Index('IDX_leave_org_status', ['organizationId', 'status'])
@Index('IDX_leave_person', ['personnelId'])
export class LeaveRequestEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: UUID_COLUMN })
  organizationId: string;

  /** شمارهٔ خوانا در هر سازمان. */
  @Column({ type: 'varchar', length: 24 })
  number: string;

  @Column({ type: UUID_COLUMN })
  personnelId: string;

  /** بخشِ کارمند هنگامِ ثبت؛ برای مسیرِ تأیید و گزارشِ بخشی. */
  @Column({ type: UUID_COLUMN, nullable: true })
  departmentId: string | null;

  @Column({ type: ENUM_COLUMN, enum: LeaveType, default: LeaveType.ANNUAL })
  type: LeaveType;

  /** از تاریخ (ISO میلادی؛ نمایش در UI شمسی). */
  @Column({ type: 'varchar', length: 10 })
  fromDate: string;

  @Column({ type: 'varchar', length: 10 })
  toDate: string;

  /**
   * تعدادِ روز.
   *
   * هنگامِ ثبت حساب و ذخیره می‌شود تا گزارش و ماندهٔ مرخصی لازم نباشد هر بار
   * بازهٔ تاریخ را دوباره بشمارند. مرخصیِ ساعتی کسرِ اعشاری می‌گیرد.
   */
  @Column({ type: 'float', default: 0 })
  days: number;

  @Column({ type: 'text', default: '' })
  reason: string;

  @Column({ type: ENUM_COLUMN, enum: LeaveStatus, default: LeaveStatus.PENDING })
  status: LeaveStatus;

  /** مدیرِ تصمیم‌گیرنده. */
  @Column({ type: UUID_COLUMN, nullable: true })
  decidedByUserId: string | null;

  @Column({ type: TIMESTAMP_COLUMN, nullable: true })
  decidedAt: Date | null;

  @Column({ type: 'text', default: '' })
  decisionNote: string;

  @Column({ type: JSON_COLUMN, default: '[]' })
  history: LeaveHistoryStep[];

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  createdAt: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN })
  updatedAt: Date;
}

/**
 * ماندهٔ مرخصیِ یک کارمند در یک سال.
 *
 * سقف را **کاربر** تعیین می‌کند، نه سامانه: سیاستِ مرخصی بین مجموعه‌ها فرق
 * دارد و حدس‌زدنش عددِ نادرست می‌سازد. مصرف از مرخصی‌های تأییدشده حساب
 * می‌شود.
 */
@Entity('leave_balances')
@Index('IDX_leave_balance_unique', ['personnelId', 'year', 'type'], {
  unique: true,
})
export class LeaveBalanceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: UUID_COLUMN })
  organizationId: string;

  @Column({ type: UUID_COLUMN })
  personnelId: string;

  /** سالِ شمسی (مثلاً ۱۴۰۴). */
  @Column({ type: 'int' })
  year: number;

  @Column({ type: ENUM_COLUMN, enum: LeaveType, default: LeaveType.ANNUAL })
  type: LeaveType;

  /** سقفِ تعیین‌شده توسطِ واحدِ منابع انسانی (روز). */
  @Column({ type: 'float', default: 0 })
  entitledDays: number;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  createdAt: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN })
  updatedAt: Date;
}
