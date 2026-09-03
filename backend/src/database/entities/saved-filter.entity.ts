import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { JSON_COLUMN, TIMESTAMP_COLUMN, UUID_COLUMN } from '../column-types';

@Entity('saved_filters')
export class SavedFilterEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: UUID_COLUMN })
  workspaceId: string;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: JSON_COLUMN, default: {} })
  definition: Record<string, unknown>;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  createdAt: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN })
  updatedAt: Date;
}
