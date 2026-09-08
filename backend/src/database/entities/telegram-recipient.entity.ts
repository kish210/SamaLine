import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TIMESTAMP_COLUMN, UUID_COLUMN } from '../column-types';

/**
 * یک مقصد تلگرام برای پاسخ‌های یک فرم.
 *
 * چند مدیر می‌توانند پاسخ‌های یک فرم را بگیرند و هر مدیر می‌تواند فقط
 * فرم‌های خودش را ببیند؛ پس رابطه «چند به چند» است و نه یک مقصد ثابت
 * برای کل فضای کاری.
 */
@Entity('telegram_recipients')
@Index(['workspaceId', 'formId'])
export class TelegramRecipientEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: UUID_COLUMN })
  workspaceId: string;

  /** `null` یعنی همه‌ی فرم‌های این فضای کاری. */
  @Column({ type: UUID_COLUMN, nullable: true })
  formId: string | null;

  /** شناسه‌ی گفتگو یا گروه تلگرام. */
  @Column({ type: 'varchar', length: 64 })
  chatId: string;

  /** نام قابل خواندن، مثل «مدیر هتل» — برای فهرست در پنل. */
  @Column({ type: 'varchar', length: 120, default: '' })
  label: string;

  /**
   * فقط پاسخ‌هایی که شاخص رضایتشان زیر این عدد است فرستاده شود.
   * `null` یعنی همه‌ی پاسخ‌ها.
   */
  @Column({ type: 'double precision', nullable: true })
  scoreThreshold: number | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  /** با هر پاسخ کامل پیام بفرست. */
  @Column({ type: 'boolean', default: true })
  notifyOnResponse: boolean;

  /**
   * گزارش دوره‌ای برای این مقصد.
   *
   * جدا از اطلاع‌رسانی تک‌تک پاسخ‌هاست: مدیری که روزی صد پاسخ می‌گیرد
   * اعلان هر پاسخ را خاموش می‌کند ولی خلاصه‌ی هفتگی را می‌خواهد.
   */
  @Column({ type: 'varchar', length: 16, default: 'none' })
  digest: 'none' | 'weekly' | 'monthly';

  /** آخرین باری که گزارش دوره‌ای فرستاده شد؛ مبنای «موعدش رسیده؟». */
  @Column({ type: TIMESTAMP_COLUMN, nullable: true })
  lastDigestAt: Date | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  lastError: string | null;

  @Column({ type: TIMESTAMP_COLUMN, nullable: true })
  lastSentAt: Date | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  createdAt: Date;
}
