import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TIMESTAMP_COLUMN, UUID_COLUMN } from '../column-types';

/**
 * کد یک‌بارمصرف ارسال‌شده به پاسخ‌دهنده.
 *
 * کد به‌صورت هش ذخیره می‌شود تا خواندن دیتابیس امکان جعل هویت ندهد.
 */
@Entity('otp_challenges')
@Index(['publicationId', 'destination'])
export class OtpChallengeEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: UUID_COLUMN })
  publicationId: string;

  /** شماره موبایل یا ایمیل گیرنده. */
  @Column({ type: 'varchar', length: 180 })
  destination: string;

  @Column({ type: 'varchar', length: 128 })
  codeHash: string;

  @Column({ type: TIMESTAMP_COLUMN })
  expiresAt: Date;

  /** شمارش تلاش ناموفق برای جلوگیری از حدس زدن کد. */
  @Column({ type: 'int', default: 0 })
  attempts: number;

  @Column({ type: 'boolean', default: false })
  consumed: boolean;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  createdAt: Date;
}
