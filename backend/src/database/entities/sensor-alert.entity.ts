import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ENUM_COLUMN, TIMESTAMP_COLUMN, UUID_COLUMN } from '../column-types';
import { ColdRoomSensorEntity } from './cold-room-sensor.entity';

export enum SensorAlertKind {
  LOW = 'low',
  HIGH = 'high',
  STALE = 'stale',
}

/**
 * هشدار سنسور: وقتی قرائت از حد مجاز خارج شود یا سنسور کهنه/آفلاین شود.
 *
 * هر هشدار یک رویداد پایدار است (تاریخچه)، با امکان «تأیید/رسیدگی» توسط
 * اپراتور (`acknowledgedAt`/`acknowledgedBy`).
 */
@Entity('sensor_alerts')
@Index('IDX_sensor_alert_sensor', ['sensorId'])
export class SensorAlertEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: UUID_COLUMN })
  sensorId: string;

  @Column({ type: ENUM_COLUMN, enum: SensorAlertKind })
  kind: SensorAlertKind;

  /** مقدار قرائتی که هشدار را ساخت (برای stale ممکن است null باشد). */
  @Column({ type: 'double precision', nullable: true })
  value: number | null;

  @Column({ type: 'varchar', length: 300, default: '' })
  message: string;

  @Column({ type: TIMESTAMP_COLUMN, nullable: true })
  acknowledgedAt: Date | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  acknowledgedBy: string | null;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  createdAt: Date;

  @ManyToOne(() => ColdRoomSensorEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sensorId' })
  sensor: ColdRoomSensorEntity;
}
