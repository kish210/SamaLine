import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TIMESTAMP_COLUMN, UUID_COLUMN } from '../column-types';

/**
 * کد یک‌بارمصرف برای وصل کردن یک گفتگوی تلگرام به یک فرم.
 *
 * هر کسی می‌تواند به ربات پیام بدهد، پس ربات به‌تنهایی نمی‌داند فرستنده
 * حق دیدن پاسخ‌های کدام فرم را دارد. مدیر در پنل کد می‌گیرد و همان را به
 * ربات می‌فرستد؛ داشتن کد یعنی دسترسی به پنل داشته، و کوتاه بودن عمرش
 * یعنی کدِ لو رفته هم به‌زودی بی‌فایده می‌شود.
 */
@Entity('telegram_link_codes')
export class TelegramLinkCodeEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 16 })
  code: string;

  @Column({ type: UUID_COLUMN })
  workspaceId: string;

  /** `null` یعنی همه‌ی فرم‌های این فضای کاری. */
  @Column({ type: UUID_COLUMN, nullable: true })
  formId: string | null;

  /** نامی که هنگام ساخت کد گذاشته شده؛ مثلا «مدیران هتل کیش». */
  @Column({ type: 'varchar', length: 120, default: '' })
  label: string;

  @Column({ type: TIMESTAMP_COLUMN })
  expiresAt: Date;

  /**
   * چند نفر می‌توانند با این کد وصل شوند. `null` یعنی بی‌شمار (تا انقضا).
   *
   * برای وصل کردن یک فرم به چند مدیر، ساختن یک کد به‌ازای هر نفر آزاردهنده
   * است؛ یک کد گروهی برای همه‌ی آن‌ها فرستاده می‌شود.
   */
  @Column({ type: 'int', nullable: true, default: 1 })
  maxUses: number | null;

  /** چند بار تا حالا استفاده شده. */
  @Column({ type: 'int', default: 0 })
  useCount: number;

  /** آخرین باری که کسی با این کد وصل شد. */
  @Column({ type: TIMESTAMP_COLUMN, nullable: true })
  usedAt: Date | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  createdAt: Date;
}
