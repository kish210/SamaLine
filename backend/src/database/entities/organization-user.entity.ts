import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { OrganizationEntity } from './organization.entity';
import { UserEntity } from './user.entity';
import { ENUM_COLUMN, TIMESTAMP_COLUMN, UUID_COLUMN } from '../column-types';

export enum OrganizationRole {
  OWNER = 'owner',
  ADMIN = 'admin',
  EDITOR = 'editor',
  ANALYST = 'analyst',
  VIEWER = 'viewer',
}

@Entity('organization_users')
@Unique('uq_organization_user', ['organizationId', 'userId'])
export class OrganizationUserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: UUID_COLUMN })
  organizationId: string;

  @Column({ type: UUID_COLUMN })
  userId: string;

  @Column({
    type: ENUM_COLUMN,
    enum: OrganizationRole,
    default: OrganizationRole.OWNER,
  })
  role: OrganizationRole;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  createdAt: Date;

  @ManyToOne(() => OrganizationEntity, (organization) => organization.users, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'organizationId' })
  organization: OrganizationEntity;

  @ManyToOne(() => UserEntity, (user) => user.organizations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;
}
