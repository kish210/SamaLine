import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PublicationEntity } from './publication.entity';
import { JSON_COLUMN, TIMESTAMP_COLUMN, UUID_COLUMN } from '../column-types';

@Entity('delivery_logs')
export class DeliveryLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: UUID_COLUMN })
  publicationId: string;

  @Column({ type: 'varchar', length: 30 })
  channel: string;

  @Column({ type: 'varchar', length: 20 })
  status: string;

  @Column({ type: JSON_COLUMN, default: {} })
  payload: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  providerMessage: string | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  createdAt: Date;

  @ManyToOne(() => PublicationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'publicationId' })
  publication: PublicationEntity;
}
