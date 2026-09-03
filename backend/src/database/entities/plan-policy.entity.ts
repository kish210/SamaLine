import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum PlanCode {
  FREE = 'free',
  PRO = 'pro',
  ORG = 'org',
  ENTERPRISE = 'enterprise',
}

@Entity('plan_policies')
export class PlanPolicyEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: PlanCode, unique: true })
  planCode: PlanCode;

  @Column({ type: 'jsonb', default: {} })
  limits: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
