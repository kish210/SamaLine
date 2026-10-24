import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TIMESTAMP_COLUMN, UUID_COLUMN } from '../column-types';
import { MaintenanceRequestEntity } from './maintenance-request.entity';

/**
 * ردپای ممیزیِ یک درخواست تعمیر: هر تغییر وضعیت/واگذاری/یادداشت یک رویداد
 * می‌سازد. تاریخچه‌ی عملیاتی پاک نمی‌شود، پس گزارش «چه کسی کِی چه کرد» ممکن است.
 */
@Entity('maintenance_events')
@Index('IDX_maintenance_event_request', ['requestId'])
export class MaintenanceEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: UUID_COLUMN })
  requestId: string;

  /** کاربرِ انجام‌دهنده (از توکن)؛ ممکن است null باشد (مثلاً خودکار). */
  @Column({ type: UUID_COLUMN, nullable: true })
  actorId: string | null;

  @Column({ type: 'varchar', length: 160, default: '' })
  actorName: string;

  /** نوع رویداد: created/status_changed/assigned/note_added/closed/archived. */
  @Column({ type: 'varchar', length: 40 })
  action: string;

  @Column({ type: 'varchar', length: 160, nullable: true })
  fromValue: string | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  toValue: string | null;

  @Column({ type: 'text', default: '' })
  note: string;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  createdAt: Date;

  @ManyToOne(() => MaintenanceRequestEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requestId' })
  request: MaintenanceRequestEntity;
}
