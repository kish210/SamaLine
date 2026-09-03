import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrganizationEntity } from './organization.entity';
import { PlanCode } from './plan-policy.entity';

@Entity('subscriptions')
export class SubscriptionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  organizationId: string;

  @Column({ type: 'enum', enum: PlanCode, default: PlanCode.FREE })
  planCode: PlanCode;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', default: {} })
  overrides: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(
    () => OrganizationEntity,
    (organization) => organization.subscriptions,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'organizationId' })
  organization: OrganizationEntity;
}
