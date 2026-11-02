import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ENUM_COLUMN, TIMESTAMP_COLUMN, UUID_COLUMN } from '../column-types';

/*
 * ساعت‌ها به‌شکلِ رشته‌ی «HH:MM» ذخیره می‌شوند، نه نوعِ time یا timestamp.
 *
 * شیفت یک ساعتِ دیواری است («۰۷:۰۰ تا ۱۵:۰۰»)، نه یک لحظه در زمان؛ اگر
 * timestamp بود، منطقهٔ زمانی و ساعتِ تابستانی می‌توانست شیفتِ صبح را جابه‌جا
 * کند. رشته‌ی ثابت در هر دو گویش یکسان کار می‌کند و مرتب‌سازی‌پذیر است.
 */

/** وضعیتِ حضورِ یک روزِ پرسنل. */
export enum AttendanceStatus {
  /** حاضر و سرِ وقت. */
  PRESENT = 'present',
  /** حاضر، ولی با تأخیر. */
  LATE = 'late',
  /** غایبِ بی‌اطلاع. */
  ABSENT = 'absent',
  /** مرخصیِ تأییدشده. */
  ON_LEAVE = 'on_leave',
  /** تعطیلِ رسمی یا off برنامه‌ریزی‌شده. */
  OFF = 'off',
}

/** منبعِ ثبتِ حضور. */
export enum AttendanceSource {
  /** ثبتِ دستیِ مدیر در پنل. */
  MANUAL = 'manual',
  /** خودِ پرسنل از ربات زد. */
  BOT = 'bot',
}

/**
 * الگوی شیفت: «صبح ۰۷:۰۰–۱۵:۰۰».
 *
 * الگو فقط برای سرعتِ برنامه‌ریزی است؛ ساعتِ واقعیِ هر روز روی خودِ تخصیص
 * کپی می‌شود، پس ویرایشِ بعدیِ الگو برنامهٔ گذشته را بازنویسی نمی‌کند.
 */
@Entity('shift_templates')
@Index('IDX_shift_templates_org', ['organizationId', 'isActive'])
export class ShiftTemplateEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: UUID_COLUMN })
  organizationId: string;

  @Column({ type: 'varchar', length: 80 })
  name: string;

  /** «HH:MM». */
  @Column({ type: 'varchar', length: 5 })
  startTime: string;

  /** «HH:MM»؛ کوچک‌تر از شروع یعنی شیفتِ شب (تا فردا). */
  @Column({ type: 'varchar', length: 5 })
  endTime: string;

  /** شیفتِ مخصوصِ یک بخش؛ null یعنی عمومی. */
  @Column({ type: UUID_COLUMN, nullable: true })
  departmentId: string | null;

  /** رنگِ نمایش در جدولِ هفتگی. */
  @Column({ type: 'varchar', length: 16, default: '' })
  color: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  createdAt: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN })
  updatedAt: Date;
}

/**
 * شیفتِ یک پرسنل در یک روز.
 *
 * ساعت‌ها از الگو کپی می‌شوند (نه ارجاع)، تا برنامهٔ اعلام‌شده به پرسنل همان
 * چیزی بماند که دیده است.
 */
@Entity('shift_assignments')
@Index('IDX_shift_assign_org_date', ['organizationId', 'date'])
@Index('IDX_shift_assign_person_date', ['personnelId', 'date'])
@Index(
  'IDX_shift_assign_unique',
  ['organizationId', 'personnelId', 'date', 'startTime'],
  { unique: true },
)
export class ShiftAssignmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: UUID_COLUMN })
  organizationId: string;

  @Column({ type: UUID_COLUMN })
  personnelId: string;

  /** الگوی مبدأ، فقط برای نام و رنگ؛ ساعت از ستون‌های خودِ این سطر می‌آید. */
  @Column({ type: UUID_COLUMN, nullable: true })
  templateId: string | null;

  /** «YYYY-MM-DD» میلادی (UTC)؛ نمایش در رابط شمسی است. */
  @Column({ type: 'varchar', length: 10 })
  date: string;

  @Column({ type: 'varchar', length: 5 })
  startTime: string;

  @Column({ type: 'varchar', length: 5 })
  endTime: string;

  /** نامِ شیفت در لحظهٔ تخصیص («صبح»)، برای نمایشِ بی‌نیاز به join. */
  @Column({ type: 'varchar', length: 80, default: '' })
  label: string;

  @Column({ type: 'varchar', length: 300, default: '' })
  note: string;

  /**
   * آخرین باری که یادآوریِ این شیفت به ربات رفت.
   *
   * روی خودِ سطر است تا با حذفِ شیفت، یادآوریِ آن هم بی‌معنا نشود.
   */
  @Column({ type: TIMESTAMP_COLUMN, nullable: true })
  reminderSentAt: Date | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  createdAt: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN })
  updatedAt: Date;
}

/**
 * حضورِ یک پرسنل در یک روز.
 *
 * ثبتِ دستی یا از ربات؛ هیچ ادعایی دربارهٔ دستگاهِ کارت‌زن نمی‌کنیم، چون
 * چنین یکپارچگی‌ای وجود ندارد. هر پرسنل در هر روز یک سطر دارد.
 */
@Entity('attendance_records')
@Index('IDX_attendance_org_date', ['organizationId', 'date'])
@Index(
  'IDX_attendance_unique',
  ['organizationId', 'personnelId', 'date'],
  { unique: true },
)
export class AttendanceRecordEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: UUID_COLUMN })
  organizationId: string;

  @Column({ type: UUID_COLUMN })
  personnelId: string;

  @Column({ type: 'varchar', length: 10 })
  date: string;

  @Column({
    type: ENUM_COLUMN,
    enum: AttendanceStatus,
    default: AttendanceStatus.PRESENT,
  })
  status: AttendanceStatus;

  /** ساعتِ ورود «HH:MM»؛ خالی یعنی ثبت نشده. */
  @Column({ type: 'varchar', length: 5, default: '' })
  checkIn: string;

  @Column({ type: 'varchar', length: 5, default: '' })
  checkOut: string;

  /** دقیقهٔ کارکرد؛ از ورود و خروج حساب می‌شود. */
  @Column({ type: 'int', default: 0 })
  minutesWorked: number;

  @Column({
    type: ENUM_COLUMN,
    enum: AttendanceSource,
    default: AttendanceSource.MANUAL,
  })
  source: AttendanceSource;

  @Column({ type: 'varchar', length: 300, default: '' })
  note: string;

  @Column({ type: UUID_COLUMN, nullable: true })
  byUserId: string | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  createdAt: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN })
  updatedAt: Date;
}

/** چه چیزی یادآوری شد. */
export enum StaffReminderKind {
  /** شیفتِ فردا. */
  SHIFT = 'shift',
  /** کارهای بازِ سپرده‌شده. */
  TASKS = 'tasks',
  /** نامهٔ نخواندهٔ مانده. */
  LETTERS = 'letters',
}

/**
 * دفترِ یادآوری‌های رفته به ربات.
 *
 * ایندکسِ یکتا روی (پرسنل، نوع، تاریخِ موضوع) یعنی زمان‌بند هر چند بار هم
 * اجرا شود — یا سرور ری‌استارت شود — پرسنل یک پیامِ تکراری نمی‌گیرد. حافظهٔ
 * درون‌پروسه این تضمین را نمی‌داد.
 */
@Entity('staff_reminder_log')
@Index(
  'IDX_staff_reminder_unique',
  ['organizationId', 'personnelId', 'kind', 'forDate'],
  { unique: true },
)
export class StaffReminderLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: UUID_COLUMN })
  organizationId: string;

  @Column({ type: UUID_COLUMN })
  personnelId: string;

  @Column({ type: ENUM_COLUMN, enum: StaffReminderKind })
  kind: StaffReminderKind;

  /** روزی که یادآوری دربارهٔ آن بود. */
  @Column({ type: 'varchar', length: 10 })
  forDate: string;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  createdAt: Date;
}
