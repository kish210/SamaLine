import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { JSON_COLUMN, TIMESTAMP_COLUMN, UUID_COLUMN } from '../column-types';

@Entity('api_keys')
export class ApiKeyEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: UUID_COLUMN })
  organizationId: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 120, unique: true })
  keyPrefix: string;

  @Column({ type: 'varchar', length: 120 })
  keyHash: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: JSON_COLUMN, default: {} })
  scopes: Record<string, unknown>;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  createdAt: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN })
  updatedAt: Date;
}
