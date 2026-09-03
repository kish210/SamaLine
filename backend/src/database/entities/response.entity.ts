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
import {
  ENUM_COLUMN,
  JSON_COLUMN,
  NOW_SQL,
  TIMESTAMP_COLUMN,
  UUID_COLUMN,
} from '../column-types';

export enum ResponseStatus {
  PARTIAL = 'partial',
  COMPLETED = 'completed',
}

@Entity('responses')
export class ResponseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: UUID_COLUMN })
  formVersionId: string;

  @Column({ type: UUID_COLUMN })
  publicationId: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  respondentKey: string | null;

  @Column({
    type: ENUM_COLUMN,
    enum: ResponseStatus,
    default: ResponseStatus.COMPLETED,
  })
  status: ResponseStatus;

  @Column({ type: TIMESTAMP_COLUMN, default: () => NOW_SQL })
  startedAt: Date;

  @Column({ type: TIMESTAMP_COLUMN, nullable: true })
  submittedAt: Date | null;

  @Column({ type: 'int', nullable: true })
  durationSeconds: number | null;

  @Column({ type: JSON_COLUMN, default: {} })
  meta: Record<string, unknown>;

  @Column({ type: JSON_COLUMN, default: {} })
  answers: Record<string, unknown>;

  @Column({ type: JSON_COLUMN, default: {} })
  scores: Record<string, unknown>;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
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
