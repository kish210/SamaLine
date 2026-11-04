import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ResponseEntity } from './response.entity';
import { UUID_COLUMN } from '../column-types';

/*
 * جدولِ تختِ پاسخ‌ها.
 *
 * بدونِ ایندکس، هر فیلترِ «پاسخ‌هایی که به سوالِ X مقدارِ Y داده‌اند» کلِ
 * جدول را می‌خواند؛ با (questionId, choiceId) و (responseId) این کار به
 * جست‌وجوی ایندکسی تبدیل می‌شود.
 */
@Entity('answer_flat')
@Index('IDX_answer_flat_response', ['responseId'])
@Index('IDX_answer_flat_question_choice', ['questionId', 'choiceId'])
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
