import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { JSON_COLUMN, TIMESTAMP_COLUMN, UUID_COLUMN } from '../column-types';

@Entity('audit_logs')
export class AuditLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: UUID_COLUMN })
  organizationId: string;

  @Column({ type: 'varchar', length: 120 })
  action: string;

  @Column({ type: 'varchar', length: 120 })
  actorType: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  actorId: string | null;

  @Column({ type: JSON_COLUMN, default: {} })
  payload: Record<string, unknown>;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  createdAt: Date;
}
