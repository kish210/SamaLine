import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { JSON_COLUMN, TIMESTAMP_COLUMN, UUID_COLUMN } from '../column-types';
import { ContactListEntity } from './contact-list.entity';

/**
 * اتصال به API نرم‌افزار دیگری که فهرست افراد را نگه می‌دارد
 * (CRM، سامانه‌ی منابع انسانی، باشگاه مشتریان و …).
 *
 * کلید احراز هویت رمزنگاری نشده ذخیره می‌شود؛ برای استقرار تولیدی باید
 * به یک مخزن راز (Vault یا رمزنگاری در سطح ستون) منتقل شود.
 */
@Entity('contact_sources')
export class ContactSourceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: UUID_COLUMN })
  organizationId: string;

  /** فهرستی که رکوردهای واردشده در آن می‌نشینند. */
  @Column({ type: UUID_COLUMN })
  listId: string;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'text' })
  url: string;

  @Column({ type: 'varchar', length: 10, default: 'GET' })
  method: string;

  /** هدرهای ثابت درخواست، مثل کلید API یا توکن. */
  @Column({ type: JSON_COLUMN, default: {} })
  headers: Record<string, string>;

  /** بدنه‌ی درخواست برای منابعی که POST می‌خواهند. */
  @Column({ type: JSON_COLUMN, default: {} })
  body: Record<string, unknown>;

  /**
   * مسیر آرایه‌ی افراد در پاسخ، با نقطه: مثلا `data.items`.
   * خالی یعنی خودِ پاسخ یک آرایه است.
   */
  @Column({ type: 'varchar', length: 200, default: '' })
  itemsPath: string;

  /**
   * نگاشت فیلدهای سامانه به کلیدهای پاسخ:
   * `{ "fullName": "name", "mobile": "phone_number" }`
   */
  @Column({ type: JSON_COLUMN, default: {} })
  mapping: Record<string, string>;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: TIMESTAMP_COLUMN, nullable: true })
  lastSyncedAt: Date | null;

  /** نتیجه‌ی آخرین همگام‌سازی برای نمایش در پنل. */
  @Column({ type: JSON_COLUMN, default: {} })
  lastResult: Record<string, unknown>;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  createdAt: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN })
  updatedAt: Date;

  @ManyToOne(() => ContactListEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listId' })
  list: ContactListEntity;
}
