import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AnswerFlatEntity } from './answer-flat.entity';
import { FormVersionEntity } from './form-version.entity';
import { PublicationEntity } from './publication.entity';
import { ResponseCommentEntity } from './response-comment.entity';

export enum ResponseStatus {
  PARTIAL = 'partial',
  COMPLETED = 'completed',
}

@Entity('responses')
export class ResponseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  formVersionId: string;

  @Column('uuid')
  publicationId: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  respondentKey: string | null;

  @Column({
    type: 'enum',
    enum: ResponseStatus,
    default: ResponseStatus.COMPLETED,
  })
  status: ResponseStatus;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  startedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  submittedAt: Date | null;

  @Column({ type: 'int', nullable: true })
  durationSeconds: number | null;

  @Column({ type: 'jsonb', default: {} })
  meta: Record<string, unknown>;

  @Column({ type: 'jsonb', default: {} })
  answers: Record<string, unknown>;

  @Column({ type: 'jsonb', default: {} })
  scores: Record<string, unknown>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => FormVersionEntity, (formVersion) => formVersion.responses, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'formVersionId' })
  formVersion: FormVersionEntity;

  @ManyToOne(() => PublicationEntity, (publication) => publication.responses, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'publicationId' })
  publication: PublicationEntity;

  @OneToMany(() => AnswerFlatEntity, (answerFlat) => answerFlat.response)
  answerFlat: AnswerFlatEntity[];

  @OneToMany(() => ResponseCommentEntity, (comment) => comment.response)
  comments: ResponseCommentEntity[];
}
