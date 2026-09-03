import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ENUM_COLUMN, JSON_COLUMN, TIMESTAMP_COLUMN } from '../column-types';

export enum JobStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  DONE = 'done',
  FAILED = 'failed',
}

/**
 * کار درصف، ذخیره‌شده در دیتابیس.
 *
 * صف درون‌حافظه با ری‌استارت سرور کارهایش را از دست می‌داد؛ برای ارسال
 * انبوه پیامک این یعنی پیام‌های نرفته‌ی بی‌سروصدا. اینجا کار پیش از
 * اجرا ثبت می‌شود تا پس از راه‌اندازی دوباره از سر گرفته شود.
 */
@Entity('queued_jobs')
@Index(['status', 'runAfter'])
export class QueuedJobEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** نوع کار، مثل `message.send`. */
  @Column({ type: 'varchar', length: 60 })
  kind: string;

  @Column({ type: JSON_COLUMN, default: {} })
  payload: Record<string, unknown>;

  @Column({
    type: ENUM_COLUMN,
    enum: JobStatus,
    default: JobStatus.PENDING,
  })
  status: JobStatus;

  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'int', default: 3 })
  maxAttempts: number;

  /** زمان زودترین اجرای مجاز؛ برای تاخیر تلاش مجدد. */
  @Column({ type: TIMESTAMP_COLUMN })
  runAfter: Date;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  createdAt: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN })
  updatedAt: Date;
}
