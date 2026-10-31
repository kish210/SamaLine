import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { JSON_COLUMN, TIMESTAMP_COLUMN, UUID_COLUMN } from '../column-types';

/**
 * گفتگوی پر کردنِ فرم داخلِ ربات (بله/تلگرام).
 *
 * وبهوک بی‌حافظه است: هر پیام جداگانه می‌رسد، پس جای سوالِ جاری و پاسخ‌های
 * تا اینجا باید جایی بماند. هر گفتگو (chatId+platform) هم‌زمان فقط یک فرمِ
 * نیمه‌کاره دارد؛ شروعِ فرمِ تازه، قبلی را جایگزین می‌کند.
 */
@Entity('bot_form_sessions')
@Index('IDX_bot_form_sessions_chat', ['chatId', 'platform'], { unique: true })
export class BotFormSessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64 })
  chatId: string;

  /** پیام‌رسان: telegram یا bale. */
  @Column({ type: 'varchar', length: 16 })
  platform: string;

  @Column({ type: UUID_COLUMN })
  formId: string;

  /** انتشارِ عمومیِ همان فرم؛ ثبتِ پاسخ از مسیرِ همین توکن انجام می‌شود. */
  @Column({ type: UUID_COLUMN })
  publicationId: string;

  /** کلیدِ پاسخ‌دهنده (موبایلِ پرسنل) تا پاسخ به نامِ خودش ثبت شود. */
  @Column({ type: 'varchar', length: 32 })
  respondentKey: string;

  /** شماره‌ی سوالی که همین حالا پرسیده شده (اندیس در فهرستِ مسطحِ سوال‌ها). */
  @Column({ type: 'int', default: 0 })
  questionIndex: number;

  /** پاسخ‌های داده‌شده تا اینجا: شناسه‌ی سوال → مقدار. */
  @Column({ type: JSON_COLUMN, default: {} })
  answers: Record<string, unknown>;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  createdAt: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN })
  updatedAt: Date;
}
