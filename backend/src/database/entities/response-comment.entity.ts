import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ResponseEntity } from './response.entity';

@Entity('response_comments')
export class ResponseCommentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  responseId: string;

  @Column({ length: 120 })
  authorName: string;

  @Column({ type: 'text' })
  body: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => ResponseEntity, (response) => response.comments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'responseId' })
  response: ResponseEntity;
}
