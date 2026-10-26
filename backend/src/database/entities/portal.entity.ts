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
 * پرتال: چند فرم روی یک صفحه‌ی عمومی.
 *
 * نشانی عمومی با «نشانک» (slug) است نه شناسه‌ی فضای کاری. نشانی مبتنی بر
 * شناسه هم زشت است هم نشتی: هر کسی که شناسه را داشته باشد فهرست فرم‌ها را
 * می‌بیند، و شناسه در نشانی‌های دیگر پیدا می‌شود.
 */
@Entity('portals')
export class PortalEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: UUID_COLUMN })
  workspaceId: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 80 })
  slug: string;

  @Column({ type: 'varchar', length: 160 })
  title: string;

  @Column({ type: 'text', default: '' })
  description: string;

  /**
   * فرم‌های پرتال، به ترتیب نمایش.
   *
   * فهرست صریح است نه «همه‌ی فرم‌های فعال»: لینکی که برای استفاده‌ی داخلی
   * منتشر شده نباید خودبه‌خود سر از صفحه‌ی عمومی دربیاورد.
   */
  @Column({ type: JSON_COLUMN, default: '[]' })
  formIds: string[];

  /**
   * بخشِ مالکِ پرتال؛ null یعنی پرتالِ عمومیِ سازمان.
   *
   * پرتالِ بخشی فقط فرم‌های همان بخش را می‌پذیرد و در پنل فقط برای اعضای
   * همان بخش (و مدیران) دیده می‌شود.
   */
  @Column({ type: UUID_COLUMN, nullable: true })
  departmentId: string | null;

  /** نشانی لوگو بالای صفحه‌ی پرتال. */
  @Column({ type: 'varchar', length: 500, default: '' })
  logoUrl: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  createdAt: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN })
  updatedAt: Date;
}
