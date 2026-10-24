import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ENUM_COLUMN, TIMESTAMP_COLUMN, UUID_COLUMN } from '../column-types';

/**
 * آماده‌بودن اتاق — **مستقل از وضعیت درخواست تعمیر**.
 *
 * یک درخواست می‌تواند «انجام‌شده» باشد ولی اتاق هنوز نیاز به بازبینی داشته باشد؛
 * یا اتاق آماده باشد در حالی که یک درخواست غیرمسدودکننده هنوز باز است. تغییر
 * آماده‌بودن تصمیمِ انسانیِ جداست و خودکار از بسته‌شدن تیکت نمی‌آید.
 */
export enum RoomReadinessStatus {
  READY = 'ready',
  NEEDS_INSPECTION = 'needs_inspection',
  NOT_READY = 'not_ready',
}

@Entity('room_readiness')
@Index('IDX_room_readiness_ws_room', ['workspaceId', 'room'], { unique: true })
@Index('IDX_room_readiness_ws_status', ['workspaceId', 'status'])
export class RoomReadinessEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: UUID_COLUMN })
  workspaceId: string;

  /** شناسه‌ی اتاق (یکتا در فضای کاری). */
  @Column({ type: 'varchar', length: 120 })
  room: string;

  @Column({ type: 'varchar', length: 120, default: '' })
  building: string;

  @Column({ type: 'varchar', length: 120, default: '' })
  floor: string;

  @Column({ type: ENUM_COLUMN, enum: RoomReadinessStatus, default: RoomReadinessStatus.NEEDS_INSPECTION })
  status: RoomReadinessStatus;

  @Column({ type: 'varchar', length: 300, default: '' })
  note: string;

  @Column({ type: 'varchar', length: 160, default: '' })
  updatedByName: string;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  createdAt: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN })
  updatedAt: Date;
}
