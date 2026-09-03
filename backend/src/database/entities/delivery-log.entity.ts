import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PublicationEntity } from './publication.entity';

@Entity('delivery_logs')
export class DeliveryLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  publicationId: string;

  @Column({ length: 30 })
  channel: string;

  @Column({ length: 20 })
  status: string;

  @Column({ type: 'jsonb', default: {} })
  payload: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  providerMessage: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => PublicationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'publicationId' })
  publication: PublicationEntity;
}
