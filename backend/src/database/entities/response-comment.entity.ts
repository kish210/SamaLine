import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ResponseEntity } from './response.entity';
import { TIMESTAMP_COLUMN, UUID_COLUMN } from '../column-types';

@Entity('response_comments')
export class ResponseCommentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: UUID_COLUMN })
  responseId: string;

  @Column({ type: 'varchar', length: 120 })
  authorName: string;

  @Column({ type: 'text' })
  body: string;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  createdAt: Date;

  @ManyToOne(() => ResponseEntity, (response) => response.comments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'responseId' })
  response: ResponseEntity;
}
