import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TIMESTAMP_COLUMN, UUID_COLUMN } from '../column-types';

/**
 * عضویتِ یک کاربر در یک بخش. هر کاربر می‌تواند در چند بخش باشد.
 *
 * دسترسیِ per-بخش بر پایه‌ی این جدول سنجیده می‌شود، جدا از نقشِ سازمانی.
 */
@Entity('department_members')
@Index('IDX_department_member_unique', ['departmentId', 'userId'], { unique: true })
@Index('IDX_department_member_user', ['userId'])
export class DepartmentMemberEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: UUID_COLUMN })
  departmentId: string;

  @Column({ type: UUID_COLUMN })
  userId: string;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  createdAt: Date;
}
