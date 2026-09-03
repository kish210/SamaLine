import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { JSON_COLUMN, TIMESTAMP_COLUMN, UUID_COLUMN } from '../column-types';
import { ContactEntity } from './contact.entity';
import { OrganizationEntity } from './organization.entity';

/** دفترچه مخاطبان سازمان برای ارسال گروهی (بند ۲ سند). */
@Entity('contact_lists')
export class ContactListEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: UUID_COLUMN })
  organizationId: string;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: JSON_COLUMN, default: [] })
  tags: string[];

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  createdAt: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN })
  updatedAt: Date;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizationId' })
  organization: OrganizationEntity;

  @OneToMany(() => ContactEntity, (contact) => contact.list)
  contacts: ContactEntity[];
}
