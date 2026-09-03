import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ENUM_COLUMN, JSON_COLUMN, TIMESTAMP_COLUMN } from '../column-types';

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

  @Column({ type: ENUM_COLUMN, enum: PlanCode, unique: true })
  planCode: PlanCode;

  @Column({ type: JSON_COLUMN, default: {} })
  limits: Record<string, unknown>;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  createdAt: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN })
  updatedAt: Date;
}
