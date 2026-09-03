import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { FormVersionEntity } from './form-version.entity';
import { PublicationEntity } from './publication.entity';
import { WorkspaceEntity } from './workspace.entity';
import {
  ENUM_COLUMN,
  JSON_COLUMN,
  TIMESTAMP_COLUMN,
  UUID_COLUMN,
} from '../column-types';

export enum FormStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  CLOSED = 'closed',
  ARCHIVED = 'archived',
}

@Entity('forms')
export class FormEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: UUID_COLUMN })
  workspaceId: string;

  @Column({ type: 'varchar', length: 220 })
  title: string;

  @Column({ type: 'varchar', unique: true, length: 220 })
  slug: string;

  @Column({ type: ENUM_COLUMN, enum: FormStatus, default: FormStatus.DRAFT })
  status: FormStatus;

  @Column({ type: JSON_COLUMN, default: {} })
  settings: Record<string, unknown>;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  createdAt: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN })
  updatedAt: Date;

  @ManyToOne(() => WorkspaceEntity, (workspace) => workspace.forms, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'workspaceId' })
  workspace: WorkspaceEntity;

  @OneToMany(() => FormVersionEntity, (version) => version.form)
  versions: FormVersionEntity[];

  @OneToMany(() => PublicationEntity, (publication) => publication.form)
  publications: PublicationEntity[];
}
