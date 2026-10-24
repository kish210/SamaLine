import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TIMESTAMP_COLUMN, UUID_COLUMN } from '../column-types';

/**
 * بخش/واحدِ سازمانی هتل (فنی، خانه‌داری، HR، IT، پیمانکاران، …).
 *
 * فرم‌های «عملیاتی» به یک بخش تعلق می‌گیرند و فقط کاربرانِ عضوِ همان بخش
 * (به‌علاوه‌ی مدیر/مالک سازمان) اجازه‌ی تکمیل/دیدنشان را دارند. فرم‌های
 * «نظرسنجی» بخش ندارند و عمومی‌اند.
 */
@Entity('departments')
@Index('IDX_department_org', ['organizationId'])
export class DepartmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: UUID_COLUMN })
  organizationId: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  /** کلیدِ اختیاریِ ماشینی برای بخش‌های استاندارد (technical/housekeeping/hr/it/contractors). */
  @Column({ type: 'varchar', length: 40, default: '' })
  key: string;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  createdAt: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN })
  updatedAt: Date;
}
