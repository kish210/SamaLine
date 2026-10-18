import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TIMESTAMP_COLUMN, UUID_COLUMN } from '../column-types';
import type { OrganizationRole } from './organization-user.entity';

/**
 * دعوت‌نامه‌ی عضویت در تیم یک سازمان.
 *
 * فقط هش توکن ذخیره می‌شود؛ لینک دعوت فقط یک بار به دعوت‌کننده نشان داده و
 * به ایمیل دعوت‌شده فرستاده می‌شود. نقش varchar است نه enum تا روی Postgres
 * نوع تازه‌ای ساخته نشود.
 */
@Entity('invitations')
export class InvitationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: UUID_COLUMN })
  organizationId: string;

  @Column({ type: 'varchar', length: 120 })
  email: string;

  @Column({ type: 'varchar', length: 20 })
  role: OrganizationRole;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  tokenHash: string;

  @Column({ type: UUID_COLUMN })
  invitedBy: string;

  @Column({ type: TIMESTAMP_COLUMN })
  expiresAt: Date;

  @Column({ type: TIMESTAMP_COLUMN, nullable: true })
  acceptedAt: Date | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  createdAt: Date;
}
