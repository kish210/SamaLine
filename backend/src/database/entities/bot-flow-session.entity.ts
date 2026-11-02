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

/** کارهای چندمرحله‌ای که داخلِ گفتگوی ربات انجام می‌شوند. */
export enum BotFlow {
  /** اعلامِ خرابی: عنوان → محل → اولویت. */
  FAULT = 'fault',
  /** درخواستِ مرخصی: از → تا → نوع → علت. */
  LEAVE = 'leave',
  /** پاسخ به نامهٔ دریافتی: فقط متن (گیرنده از پیش معلوم است). */
  LETTER_REPLY = 'letter_reply',
}

/**
 * گفتگوی چندمرحله‌ایِ ربات.
 *
 * وبهوک بی‌حافظه است: هر پیام جداگانه می‌رسد، پس «کجای کار هستیم» و
 * «تا اینجا چه گفته» باید جایی بماند. جدا از `bot_form_sessions` است
 * چون آن یکی به فرم و نسخه‌ی فرم گره خورده، و این‌ها کارهای خودِ سامانه‌اند
 * (خرابی، مرخصی، نامه) — جا دادنشان در همان جدول یعنی ستون‌هایی که برای
 * نیمی از رکوردها بی‌معنا می‌مانند.
 *
 * هر گفتگو هم‌زمان یک کارِ نیمه‌کاره دارد؛ شروعِ کارِ تازه قبلی را
 * جایگزین می‌کند.
 */
@Entity('bot_flow_sessions')
@Index('IDX_bot_flow_chat', ['chatId', 'platform'], { unique: true })
export class BotFlowSessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: UUID_COLUMN })
  organizationId: string;

  /** پرسنلی که این کار به نامِ او ثبت می‌شود. */
  @Column({ type: UUID_COLUMN })
  personnelId: string;

  @Column({ type: 'varchar', length: 64 })
  chatId: string;

  @Column({ type: 'varchar', length: 16 })
  platform: string;

  @Column({ type: ENUM_COLUMN, enum: BotFlow })
  flow: BotFlow;

  /** قدمِ جاری؛ از صفر. */
  @Column({ type: 'int', default: 0 })
  step: number;

  /** پاسخ‌های داده‌شده تا اینجا. */
  @Column({ type: JSON_COLUMN, default: '{}' })
  data: Record<string, unknown>;

  /** موضوعِ کار؛ برای پاسخِ نامه، شناسهٔ نامهٔ اصلی. */
  @Column({ type: UUID_COLUMN, nullable: true })
  contextId: string | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  createdAt: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN })
  updatedAt: Date;
}
