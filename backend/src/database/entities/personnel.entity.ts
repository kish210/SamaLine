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

/** وضعیتِ اشتغالِ کارمند. */
export enum EmploymentStatus {
  ACTIVE = 'active',
  ON_LEAVE = 'on_leave',
  SUSPENDED = 'suspended',
  TERMINATED = 'terminated',
}

/** نوعِ قرارداد. */
export enum ContractType {
  FULL_TIME = 'full_time',
  PART_TIME = 'part_time',
  CONTRACT = 'contract',
  TEMPORARY = 'temporary',
  PROBATION = 'probation',
}

/** یک مدرک/فایلِ پیوستِ پروندهٔ پرسنل (قرارداد، کارت ملی، گواهی …). */
export interface PersonnelDocument {
  name: string;
  /** نشانیِ فایل اگر آپلود شده باشد. */
  url?: string;
  note?: string;
}

/**
 * پروندهٔ پرسنل به‌عنوان داده‌ی پایهٔ HR (فاز E).
 *
 * شماره موبایل کلیدِ اتصال به ربات بله در فاز F است؛ وقتی HR آن را ثبت کرد،
 * همان پرسنل می‌تواند از بله واردِ پورتالِ خودش شود. موبایل در هر سازمان یکتاست
 * (وقتی خالی نباشد)؛ یکتاییِ خالی‌ها در سرویس کنترل می‌شود نه با ایندکسِ DB،
 * تا چند پروندهٔ بدونِ موبایل مجاز بماند.
 */
@Entity('personnel')
@Index('IDX_personnel_org', ['organizationId'])
@Index('IDX_personnel_mobile', ['organizationId', 'mobile'])
@Index('IDX_personnel_chat', ['botPlatform', 'botChatId'])
export class PersonnelEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: UUID_COLUMN })
  organizationId: string;

  @Column({ type: 'varchar', length: 120 })
  fullName: string;

  /** موبایل؛ کلیدِ اتصال به بله (فاز F). خالی مجاز است. */
  @Column({ type: 'varchar', length: 20, default: '' })
  mobile: string;

  /** کد پرسنلی داخلیِ سازمان (اختیاری). */
  @Column({ type: 'varchar', length: 40, default: '' })
  employeeNo: string;

  /** سمت/عنوانِ شغلی. */
  @Column({ type: 'varchar', length: 80, default: '' })
  position: string;

  /** بخشِ محلِ خدمت (اختیاری؛ به `departments.id` اشاره دارد). */
  @Column({ type: UUID_COLUMN, nullable: true })
  departmentId: string | null;

  /** تاریخ استخدام به‌صورت 'YYYY-MM-DD' میلادی (اختیاری؛ در UI شمسی). */
  @Column({ type: 'varchar', length: 10, default: '' })
  hireDate: string;

  @Column({ type: JSON_COLUMN, default: '[]' })
  documents: PersonnelDocument[];

  @Column({ type: 'text', default: '' })
  notes: string;

  /**
   * شناسه‌ی گفتگوی رباتِ پرسنل (بله/تلگرام) پس از اتصال با موبایل — فاز F.
   * خالی یعنی هنوز به ربات وصل نشده.
   */
  @Column({ type: 'varchar', length: 40, nullable: true })
  botChatId: string | null;

  /** پیام‌رسانِ گفتگوی متصل: 'bale' یا 'telegram'. */
  @Column({ type: 'varchar', length: 16, default: '' })
  botPlatform: string;

  /**
   * فضای کاریِ رباتی که پرسنل از طریقش وصل شده — فاز F.
   *
   * یک گفتگو فقط از همان رباتی که کاربر شروعش کرده پیام می‌گیرد؛ پس برای ارسالِ
   * اطلاعیه باید بدانیم کدام ربات به این پرسنل می‌رسد. به `telegram_integrations
   * .workspaceId` (یکتا) اشاره دارد.
   */
  @Column({ type: UUID_COLUMN, nullable: true })
  botWorkspaceId: string | null;

  /**
   * وضعیتِ اشتغال.
   *
   * جدا از `isActive` است: `isActive` یعنی رکورد در فهرست‌ها دیده شود، ولی
   * وضعیت می‌گوید کارمند سرِ کار است، در مرخصی است یا قطعِ همکاری کرده —
   * چیزی که گزارشِ نیروی انسانی و کارتابل لازم دارند.
   */
  @Column({
    type: ENUM_COLUMN,
    enum: EmploymentStatus,
    default: EmploymentStatus.ACTIVE,
  })
  employmentStatus: EmploymentStatus;

  /** نوعِ قرارداد (تمام‌وقت، پاره‌وقت، پیمانی، آزمایشی …). */
  @Column({
    type: ENUM_COLUMN,
    enum: ContractType,
    default: ContractType.FULL_TIME,
  })
  contractType: ContractType;

  /** پایانِ قرارداد (ISO)؛ خالی یعنی نامحدود. مبنای هشدارِ انقضا. */
  @Column({ type: 'varchar', length: 10, default: '' })
  contractEndsAt: string;

  /** تاریخِ پایانِ همکاری (ISO)؛ خالی یعنی هنوز شاغل است. */
  @Column({ type: 'varchar', length: 10, default: '' })
  terminatedAt: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  createdAt: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN })
  updatedAt: Date;
}
