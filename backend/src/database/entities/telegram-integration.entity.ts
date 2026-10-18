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
 * فقط خودِ ربات اینجاست، نه مقصدها: هر فضای کاری یک ربات دارد ولی پاسخ هر
 * فرم می‌تواند به چند گفتگوی متفاوت برود. مقصدها در
 * `TelegramRecipientEntity` نگه‌داری می‌شوند.
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

  /**
   * پیام‌رسان مقصد: تلگرام یا بله (bale.ai).
   *
   * API ربات هر دو سازگار است و فقط نشانی پایه فرق دارد؛ چون تلگرام در ایران
   * فیلتر است، بله اغلب انتخاب عملی‌تری است. هر فضای کاری یک ربات دارد، پس
   * همین یک ستون کافی است.
   */
  @Column({ type: 'varchar', length: 16, default: 'telegram' })
  platform: 'telegram' | 'bale';

  /**
   * توکن تصادفی داخل نشانی وبهوک.
   *
   * تلگرام هر پیام کاربران را به این نشانی می‌فرستد؛ چون نشانی عمومی است،
   * توکن تصادفی داخل مسیر تنها چیزی است که ثابت می‌کند فراخوان واقعا از
   * تلگرام آمده و کسی نشانی را حدس نزده.
   */
  @Column({ type: 'varchar', length: 64, nullable: true, unique: true })
  webhookToken: string | null;

  /** نام کاربری ربات (@…)، فقط برای نمایش در پنل. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  botUsername: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

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
