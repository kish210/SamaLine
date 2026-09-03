import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { ResponseEntity } from './response.entity';
import { FormEntity } from './form.entity';
import { JSON_COLUMN, TIMESTAMP_COLUMN, UUID_COLUMN } from '../column-types';

@Entity('form_versions')
@Unique('uq_form_versions_form_version', ['formId', 'version'])
export class FormVersionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: UUID_COLUMN })
  formId: string;

  @Column('int')
  version: number;

  @Column({ type: JSON_COLUMN, default: {} })
  structure: Record<string, unknown>;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  createdAt: Date;

  @ManyToOne(() => FormEntity, (form) => form.versions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'formId' })
  form: FormEntity;

  @OneToMany(() => ResponseEntity, (response) => response.formVersion)
  responses: ResponseEntity[];
}
