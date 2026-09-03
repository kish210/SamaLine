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
import { FormEntity } from './form.entity';
import { OrganizationEntity } from './organization.entity';

@Entity('workspaces')
export class WorkspaceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  organizationId: string;

  @Column({ length: 180 })
  name: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(
    () => OrganizationEntity,
    (organization) => organization.workspaces,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'organizationId' })
  organization: OrganizationEntity;

  @OneToMany(() => FormEntity, (form) => form.workspace)
  forms: FormEntity[];
}
