import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { OrganizationEntity } from './organization.entity';

@Entity('usage_counters')
@Unique('uq_usage_org_period_metric', ['organizationId', 'periodKey', 'metric'])
export class UsageCounterEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  organizationId: string;

  @Column({ length: 20 })
  periodKey: string;

  @Column({ length: 60 })
  metric: string;

  @Column({ type: 'int', default: 0 })
  used: number;

  @Column({ type: 'int', default: 0 })
  limitValue: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(
    () => OrganizationEntity,
    (organization) => organization.usageCounters,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'organizationId' })
  organization: OrganizationEntity;
}
