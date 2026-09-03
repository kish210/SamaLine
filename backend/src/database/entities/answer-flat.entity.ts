import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ResponseEntity } from './response.entity';
import { UUID_COLUMN } from '../column-types';

@Entity('answer_flat')
export class AnswerFlatEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: UUID_COLUMN })
  responseId: string;

  @Column({ type: 'varchar', length: 80 })
  questionId: string;

  @Column({ type: 'text', nullable: true })
  valueText: string | null;

  @Column({ type: 'double precision', nullable: true })
  valueNumber: number | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  choiceId: string | null;

  @ManyToOne(() => ResponseEntity, (response) => response.answerFlat, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'responseId' })
  response: ResponseEntity;
}
