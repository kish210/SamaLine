import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { JSON_COLUMN, TIMESTAMP_COLUMN, UUID_COLUMN } from '../column-types';

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

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  createdAt: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN })
  updatedAt: Date;
}
