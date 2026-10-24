import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ENUM_COLUMN, JSON_COLUMN, TIMESTAMP_COLUMN, UUID_COLUMN } from '../column-types';

/**
 * نوع اتصال سنسور سردخانه.
 *
 * عمداً فقط گزینه‌های «اثبات‌شده» هست: `manual` (ثبت دستی اپراتور)، `http`
 * (خواندن از یک نقطه‌ی HTTP سازگار که پاسخ JSON می‌دهد) و `simulated`
 * (داده‌ی آزمایشیِ توسعه، که صریحاً علامت می‌خورد). MQTT/Modbus تا وقتی
 * مشخصات واقعی سخت‌افزار نرسد اضافه نمی‌شود.
 */
export enum SensorConnectorKind {
  MANUAL = 'manual',
  HTTP = 'http',
  SIMULATED = 'simulated',
}

export enum SensorHealth {
  OK = 'ok',
  LOW = 'low',
  HIGH = 'high',
  STALE = 'stale',
  UNKNOWN = 'unknown',
}

/** یک سنسور دمای سردخانه‌ی هتل. */
@Entity('cold_room_sensors')
@Index('IDX_cold_room_ws', ['workspaceId'])
export class ColdRoomSensorEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: UUID_COLUMN })
  workspaceId: string;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  /** محل سردخانه (مثلاً «انبار سرد آشپزخانه»). */
  @Column({ type: 'varchar', length: 200, default: '' })
  location: string;

  /** واحد دما: C یا F. */
  @Column({ type: 'varchar', length: 1, default: 'C' })
  unit: 'C' | 'F';

  /** حدِ پایین مجاز؛ null یعنی بدون حدِ پایین. */
  @Column({ type: 'double precision', nullable: true })
  minThreshold: number | null;

  @Column({ type: 'double precision', nullable: true })
  maxThreshold: number | null;

  /** پس از این مدت بدون داده‌ی تازه، سنسور «کهنه/آفلاین» شمرده می‌شود. */
  @Column({ type: 'int', default: 600 })
  staleAfterSeconds: number;

  @Column({ type: ENUM_COLUMN, enum: SensorConnectorKind, default: SensorConnectorKind.SIMULATED })
  connector: SensorConnectorKind;

  /**
   * پیکربندی اتصال؛ رازها (مثل توکن HTTP) پیش از ذخیره با secret-box رمز
   * می‌شوند و هرگز از API برنمی‌گردند.
   */
  @Column({ type: JSON_COLUMN, default: {} })
  connectorConfig: Record<string, unknown>;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'double precision', nullable: true })
  lastValue: number | null;

  @Column({ type: TIMESTAMP_COLUMN, nullable: true })
  lastReadingAt: Date | null;

  @Column({ type: ENUM_COLUMN, enum: SensorHealth, default: SensorHealth.UNKNOWN })
  lastHealth: SensorHealth;

  @CreateDateColumn({ type: TIMESTAMP_COLUMN })
  createdAt: Date;

  @UpdateDateColumn({ type: TIMESTAMP_COLUMN })
  updatedAt: Date;
}
