import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { JSON_COLUMN, TIMESTAMP_COLUMN, UUID_COLUMN } from '../column-types';
import { ContactListEntity } from './contact-list.entity';

/** یک مخاطب در دفترچه. حداقل یکی از موبایل یا ایمیل باید پر باشد. */
@Entity('contacts')
@Index(['listId', 'mobile'])
@Index(['listId', 'email'])
export class ContactEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: UUID_COLUMN })
  listId: string;

  @Column({ type: 'varchar', length: 160, nullable: true })
  fullName: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  mobile: string | null;

  @Column({ type: 'varchar', length: 180, nullable: true })
  email: string | null;

  /** متغیرهای دلخواه برای شخصی‌سازی متن پیام. */
  @Column({ type: JSON_COLUMN, default: {} })
  variables: Record<string, unknown>;

  @Column({ type: JSON_COLUMN, default: [] })
  tags: string[];

  /** لغو اشتراک: مخاطب دیگر پیام نمی‌گیرد. */
  @Column({ type: 'boolean', default: false })
  unsubscribed: boolean;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  createdAt: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN })
  updatedAt: Date;

  @ManyToOne(() => ContactListEntity, (list) => list.contacts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'listId' })
  list: ContactListEntity;
}
