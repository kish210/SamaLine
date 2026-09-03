import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SubscriptionEntity } from './subscription.entity';
import { UsageCounterEntity } from './usage-counter.entity';
import { OrganizationUserEntity } from './organization-user.entity';
import { WorkspaceEntity } from './workspace.entity';
import { TIMESTAMP_COLUMN } from '../column-types';

@Entity('organizations')
export class OrganizationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 180 })
  name: string;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  createdAt: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN })
  updatedAt: Date;

  @OneToMany(() => WorkspaceEntity, (workspace) => workspace.organization)
  workspaces: WorkspaceEntity[];

  @OneToMany(() => OrganizationUserEntity, (member) => member.organization)
  users: OrganizationUserEntity[];

  @OneToMany(
    () => SubscriptionEntity,
    (subscription) => subscription.organization,
  )
  subscriptions: SubscriptionEntity[];

  @OneToMany(() => UsageCounterEntity, (usage) => usage.organization)
  usageCounters: UsageCounterEntity[];
}
