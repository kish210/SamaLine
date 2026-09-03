import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { OrganizationUserEntity } from './organization-user.entity';
import { WorkspaceEntity } from './workspace.entity';

@Entity('organizations')
export class OrganizationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 180 })
  name: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => WorkspaceEntity, (workspace) => workspace.organization)
  workspaces: WorkspaceEntity[];

  @OneToMany(() => OrganizationUserEntity, (member) => member.organization)
  users: OrganizationUserEntity[];
}
