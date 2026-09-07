import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TIMESTAMP_COLUMN, UUID_COLUMN } from '../column-types';

/**
 * اتصال یک فضای کاری به ربات تلگرام.
 *
 * هر فضای کاری یک ردیف دارد (نه بیشتر)؛ اگر تیم بخواهد چند مقصد داشته باشد
 * می‌تواند از گروه تلگرام استفاده کند، که همان یک شناسه‌ی گفتگو است.
 */
@Entity('telegram_integrations')
export class TelegramIntegrationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: UUID_COLUMN, unique: true })
  workspaceId: string;

  /**
   * توکن ربات از BotFather.
   *
   * این توکن اجازه‌ی کامل روی ربات می‌دهد، پس هیچ‌وقت به پنل برنمی‌گردد؛
   * سرویس فقط می‌گوید تنظیم شده یا نه.
   */
  @Column({ type: 'varchar', length: 120 })
  botToken: string;

  /** شناسه‌ی گفتگو یا گروه مقصد. */
  @Column({ type: 'varchar', length: 64 })
  chatId: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  /** با هر پاسخ کامل پیام بفرست. */
  @Column({ type: 'boolean', default: true })
  notifyOnResponse: boolean;

  /**
   * فقط پاسخ‌هایی که شاخص رضایتشان زیر این عدد است اطلاع داده شود.
   * `null` یعنی همه‌ی پاسخ‌ها.
   */
  @Column({ type: 'double precision', nullable: true })
  scoreThreshold: number | null;

  /** نتیجه‌ی آخرین ارسال؛ برای عیب‌یابی در پنل. */
  @Column({ type: 'varchar', length: 300, nullable: true })
  lastError: string | null;

  @Column({ type: TIMESTAMP_COLUMN, nullable: true })
  lastSentAt: Date | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  createdAt: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN })
  updatedAt: Date;
}
