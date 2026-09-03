import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('kiosk_sessions')
export class KioskSessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  publicationId: string;

  @Column({ length: 80 })
  deviceCode: string;

  @Column({ default: true })
  isLocked: boolean;

  @Column({ type: 'jsonb', default: {} })
  lastSyncPayload: Record<string, unknown>;

  @Column({ type: 'timestamptz', nullable: true })
  lastSyncedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
