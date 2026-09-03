import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('saved_filters')
export class SavedFilterEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  workspaceId: string;

  @Column({ length: 160 })
  name: string;

  @Column({ type: 'jsonb', default: {} })
  definition: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
