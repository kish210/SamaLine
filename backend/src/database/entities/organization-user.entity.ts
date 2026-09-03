import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { OrganizationEntity } from './organization.entity';
import { UserEntity } from './user.entity';

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

  @Column('uuid')
  organizationId: string;

  @Column('uuid')
  userId: string;

  @Column({ type: 'enum', enum: OrganizationRole, default: OrganizationRole.OWNER })
  role: OrganizationRole;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => OrganizationEntity, (organization) => organization.users, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization: OrganizationEntity;

  @ManyToOne(() => UserEntity, (user) => user.organizations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: UserEntity;
}
