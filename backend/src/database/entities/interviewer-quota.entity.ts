import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TIMESTAMP_COLUMN, UUID_COLUMN } from '../column-types';

@Entity('interviewer_quotas')
export class InterviewerQuotaEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: UUID_COLUMN })
  publicationId: string;

  @Column({ type: 'varchar', length: 120 })
  interviewerName: string;

  @Column({ type: 'int', default: 0 })
  assignedQuota: number;

  @Column({ type: 'int', default: 0 })
  usedQuota: number;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  createdAt: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN })
  updatedAt: Date;
}
