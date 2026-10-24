import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TIMESTAMP_COLUMN, UUID_COLUMN } from '../column-types';
import { ColdRoomSensorEntity } from './cold-room-sensor.entity';

/**
 * یک قرائت دمای ثبت‌شده برای تاریخچه و روند.
 *
 * `isSimulated` قرائت‌های آزمایشی (شبیه‌ساز توسعه) را صریح علامت می‌زند تا هرگز
 * با داده‌ی سنسور واقعی اشتباه گرفته نشوند.
 */
@Entity('sensor_readings')
@Index('IDX_sensor_reading_sensor_time', ['sensorId', 'observedAt'])
export class SensorReadingEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: UUID_COLUMN })
  sensorId: string;

  @Column({ type: 'double precision' })
  value: number;

  @Column({ type: 'varchar', length: 1, default: 'C' })
  unit: 'C' | 'F';

  /** داده‌ی آزمایشی؟ (شبیه‌ساز توسعه) */
  @Column({ type: 'boolean', default: false })
  isSimulated: boolean;

  @Column({ type: TIMESTAMP_COLUMN })
  observedAt: Date;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  createdAt: Date;

  @ManyToOne(() => ColdRoomSensorEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sensorId' })
  sensor: ColdRoomSensorEntity;
}
