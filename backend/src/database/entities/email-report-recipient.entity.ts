import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TIMESTAMP_COLUMN, UUID_COLUMN } from '../column-types';

/**
 * گیرنده‌ی گزارش دوره‌ای ایمیلی.
 *
 * جدا از مقصدهای تلگرام/بله است: مدیری که ایمیل را دنبال می‌کند لازم نیست
 * ربات داشته باشد. هر گیرنده می‌گوید خلاصه‌ی کدام فرم با چه بازه‌ای به کدام
 * ایمیل برود.
 */
@Entity('email_report_recipients')
@Index('IDX_email_report_ws_form', ['workspaceId', 'formId'])
export class EmailReportRecipientEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: UUID_COLUMN })
  workspaceId: string;

  /** `null` یعنی همه‌ی فرم‌های این فضای کاری. */
  @Column({ type: UUID_COLUMN, nullable: true })
  formId: string | null;

  @Column({ type: 'varchar', length: 160 })
  email: string;

  /** نام قابل خواندن برای فهرست در پنل. */
  @Column({ type: 'varchar', length: 120, default: '' })
  label: string;

  /** بازه‌ی گزارش؛ گزارش ایمیلی ذاتاً دوره‌ای است. */
  @Column({ type: 'varchar', length: 16, default: 'weekly' })
  digest: 'weekly' | 'monthly';

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  /** آخرین باری که گزارش فرستاده شد؛ مبنای «موعدش رسیده؟». */
  @Column({ type: TIMESTAMP_COLUMN, nullable: true })
  lastDigestAt: Date | null;

  @Column({ type: 'varchar', length: 300, nullable: true })
  lastError: string | null;

  @Column({ type: TIMESTAMP_COLUMN, nullable: true })
  lastSentAt: Date | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  createdAt: Date;
}
