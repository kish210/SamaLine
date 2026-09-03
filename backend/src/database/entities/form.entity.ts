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

  @Column('uuid')
  workspaceId: string;

  @Column({ length: 220 })
  title: string;

  @Column({ unique: true, length: 220 })
  slug: string;

  @Column({ type: 'enum', enum: FormStatus, default: FormStatus.DRAFT })
  status: FormStatus;

  @Column({ type: 'jsonb', default: {} })
  settings: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
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
