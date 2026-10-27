import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TIMESTAMP_COLUMN, UUID_COLUMN } from '../column-types';

/**
 * اطلاعیهٔ سازمانیِ ماندگار (فاز G).
 *
 * اطلاعیه‌های فاز F فقط به بله می‌رفتند و ردی نمی‌ماند. اینجا هر اطلاعیه ثبت
 * می‌شود تا تاریخچه و مَمیزی داشته باشیم و بعدتر در بله/پورتال هم دیده شود.
 */
@Entity('announcements')
@Index('IDX_announcement_org', ['organizationId', 'createdAt'])
export class AnnouncementEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: UUID_COLUMN })
  organizationId: string;

  /** بخشِ مقصد؛ null یعنی همهٔ پرسنل. */
  @Column({ type: UUID_COLUMN, nullable: true })
  departmentId: string | null;

  @Column({ type: 'varchar', length: 120 })
  title: string;

  @Column({ type: 'text', default: '' })
  body: string;

  /** ایمیلِ مدیری که فرستاد (برای مَمیزی). */
  @Column({ type: 'varchar', length: 160, default: '' })
  sentByEmail: string;

  /** شمارِ پرسنلی که اطلاعیه در بله به آن‌ها رسید. */
  @Column({ type: 'int', default: 0 })
  recipientCount: number;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  createdAt: Date;
}
