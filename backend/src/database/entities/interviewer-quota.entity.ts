import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('interviewer_quotas')
export class InterviewerQuotaEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  publicationId: string;

  @Column({ length: 120 })
  interviewerName: string;

  @Column({ type: 'int', default: 0 })
  assignedQuota: number;

  @Column({ type: 'int', default: 0 })
  usedQuota: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
