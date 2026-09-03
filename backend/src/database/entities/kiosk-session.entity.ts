import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { JSON_COLUMN, TIMESTAMP_COLUMN, UUID_COLUMN } from '../column-types';

@Entity('kiosk_sessions')
export class KioskSessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: UUID_COLUMN })
  publicationId: string;

  @Column({ type: 'varchar', length: 80 })
  deviceCode: string;

  @Column({ type: 'boolean', default: true })
  isLocked: boolean;

  @Column({ type: JSON_COLUMN, default: {} })
  lastSyncPayload: Record<string, unknown>;

  @Column({ type: TIMESTAMP_COLUMN, nullable: true })
  lastSyncedAt: Date | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  createdAt: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN })
  updatedAt: Date;
}
