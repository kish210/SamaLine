import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { JSON_COLUMN, TIMESTAMP_COLUMN, UUID_COLUMN } from '../column-types';

/** یک قلم/دارایی داخل اتاق (تلویزیون، کولر، یخچال …). */
export interface RoomAsset {
  name: string;
  /** شماره‌ی سریال یا دارایی، در صورت وجود. */
  serial?: string;
  note?: string;
}

/**
 * اتاق/واحدِ هتل به‌عنوان داده‌ی پایه (فاز D).
 *
 * هدف: فرم‌های عملیاتی به‌جای تایپِ دستیِ شماره اتاق، از فهرستِ همین اتاق‌ها
 * انتخاب کنند تا سوابقِ هر اتاق یکدست و قابل‌گزارش بماند. برای هتلِ ۲۰۰
 * اتاقه با ساختِ گروهی پر می‌شود.
 */
@Entity('hotel_rooms')
@Index('IDX_hotel_room_org', ['organizationId'])
@Index('IDX_hotel_room_unique', ['organizationId', 'number'], { unique: true })
export class HotelRoomEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: UUID_COLUMN })
  organizationId: string;

  /** شماره‌ی اتاق؛ رشته است چون ممکن است حرف داشته باشد (مثل «B12»). */
  @Column({ type: 'varchar', length: 20 })
  number: string;

  @Column({ type: 'int', default: 0 })
  floor: number;

  /** نوع اتاق: استاندارد، سوئیت، … (اختیاری). */
  @Column({ type: 'varchar', length: 60, default: '' })
  kind: string;

  @Column({ type: JSON_COLUMN, default: '[]' })
  assets: RoomAsset[];

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  createdAt: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN })
  updatedAt: Date;
}
