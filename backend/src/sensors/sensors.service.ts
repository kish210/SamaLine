import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Repository } from 'typeorm';
import {
  ColdRoomSensorEntity,
  SensorConnectorKind,
  SensorHealth,
} from '../database/entities/cold-room-sensor.entity';
import { SensorReadingEntity } from '../database/entities/sensor-reading.entity';
import {
  SensorAlertEntity,
  SensorAlertKind,
} from '../database/entities/sensor-alert.entity';
import { TenantAccessService } from '../common/tenant-access.service';
import { encryptSecret } from '../common/secret-box';
import type { JwtUser } from '../common/current-user.decorator';
import { connectorFor, type SensorReadResult } from './connectors';

const POLL_INTERVAL_MS = 60 * 1000;

export interface SensorInput {
  name?: string;
  location?: string;
  unit?: 'C' | 'F';
  minThreshold?: number | null;
  maxThreshold?: number | null;
  staleAfterSeconds?: number;
  connector?: SensorConnectorKind;
  connectorConfig?: Record<string, unknown>;
  isActive?: boolean;
}

@Injectable()
export class SensorsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SensorsService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(ColdRoomSensorEntity)
    private readonly sensors: Repository<ColdRoomSensorEntity>,
    @InjectRepository(SensorReadingEntity)
    private readonly readings: Repository<SensorReadingEntity>,
    @InjectRepository(SensorAlertEntity)
    private readonly alerts: Repository<SensorAlertEntity>,
    private readonly tenant: TenantAccessService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.poll(), POLL_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  assertAccess(workspaceId: string, user: JwtUser): Promise<void> {
    return this.tenant.assertWorkspace(workspaceId, user);
  }

  // ── CRUD سنسور ────────────────────────────────────────────────────────────

  list(workspaceId: string) {
    return this.sensors.find({ where: { workspaceId }, order: { name: 'ASC' } });
  }

  async create(workspaceId: string, input: SensorInput) {
    if (!input.name?.trim()) throw new BadRequestException('نام سنسور لازم است');
    return this.sensors.save(
      this.sensors.create({
        workspaceId,
        name: input.name.trim().slice(0, 160),
        location: (input.location ?? '').slice(0, 200),
        unit: input.unit === 'F' ? 'F' : 'C',
        minThreshold: nullableNum(input.minThreshold),
        maxThreshold: nullableNum(input.maxThreshold),
        staleAfterSeconds: clampInt(input.staleAfterSeconds, 60, 86400, 600),
        connector: input.connector ?? SensorConnectorKind.SIMULATED,
        connectorConfig: encryptConfig(input.connectorConfig),
        isActive: input.isActive ?? true,
        lastHealth: SensorHealth.UNKNOWN,
      }),
    );
  }

  async update(workspaceId: string, id: string, input: SensorInput) {
    const sensor = await this.sensors.findOne({ where: { id, workspaceId } });
    if (!sensor) throw new NotFoundException('سنسور یافت نشد');
    if (input.name !== undefined) sensor.name = input.name.trim().slice(0, 160);
    if (input.location !== undefined) sensor.location = input.location.slice(0, 200);
    if (input.unit !== undefined) sensor.unit = input.unit === 'F' ? 'F' : 'C';
    if (input.minThreshold !== undefined) sensor.minThreshold = nullableNum(input.minThreshold);
    if (input.maxThreshold !== undefined) sensor.maxThreshold = nullableNum(input.maxThreshold);
    if (input.staleAfterSeconds !== undefined)
      sensor.staleAfterSeconds = clampInt(input.staleAfterSeconds, 60, 86400, 600);
    if (input.connector !== undefined) sensor.connector = input.connector;
    if (input.connectorConfig !== undefined)
      sensor.connectorConfig = encryptConfig(input.connectorConfig, sensor.connectorConfig);
    if (input.isActive !== undefined) sensor.isActive = input.isActive;
    return this.sensors.save(sensor);
  }

  async remove(workspaceId: string, id: string) {
    await this.sensors.delete({ id, workspaceId });
    return { ok: true };
  }

  // ── قرائت و ارزیابی ────────────────────────────────────────────────────────

  async readingsFor(workspaceId: string, sensorId: string, limit = 200) {
    await this.ensureSensor(workspaceId, sensorId);
    return this.readings.find({
      where: { sensorId },
      order: { observedAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 1000),
    });
  }

  /** ثبت دستی قرائت (اتصال manual یا تکمیل دستی). */
  async submitManualReading(
    workspaceId: string,
    sensorId: string,
    value: number,
  ) {
    const sensor = await this.ensureSensor(workspaceId, sensorId);
    if (!Number.isFinite(value)) throw new BadRequestException('مقدار دما نامعتبر است');
    await this.ingest(sensor, {
      value,
      unit: sensor.unit,
      observedAt: new Date(),
      isSimulated: false,
    });
    return this.sensors.findOne({ where: { id: sensorId } });
  }

  /**
   * ثبت یک قرائت + ارزیابی حد مجاز و ساخت/حفظ هشدار.
   *
   * هشدار تکراری نمی‌سازد: فقط اگر هشدارِ تأییدنشده‌ای از همان نوع باز نباشد.
   */
  async ingest(sensor: ColdRoomSensorEntity, result: SensorReadResult) {
    await this.readings.save(
      this.readings.create({
        sensorId: sensor.id,
        value: result.value,
        unit: result.unit,
        isSimulated: result.isSimulated,
        observedAt: result.observedAt,
      }),
    );

    let health: SensorHealth = SensorHealth.OK;
    if (sensor.minThreshold !== null && result.value < sensor.minThreshold) {
      health = SensorHealth.LOW;
      await this.raiseAlert(sensor, SensorAlertKind.LOW, result.value,
        `دمای ${result.value}° زیر حد مجاز (${sensor.minThreshold}°)`);
    } else if (sensor.maxThreshold !== null && result.value > sensor.maxThreshold) {
      health = SensorHealth.HIGH;
      await this.raiseAlert(sensor, SensorAlertKind.HIGH, result.value,
        `دمای ${result.value}° بالای حد مجاز (${sensor.maxThreshold}°)`);
    }

    sensor.lastValue = result.value;
    sensor.lastReadingAt = result.observedAt;
    sensor.lastHealth = health;
    await this.sensors.save(sensor);
  }

  private async raiseAlert(
    sensor: ColdRoomSensorEntity,
    kind: SensorAlertKind,
    value: number | null,
    message: string,
  ) {
    const open = await this.alerts.findOne({
      where: { sensorId: sensor.id, kind, acknowledgedAt: IsNull() },
    });
    if (open) return; // هشدار باز از همین نوع هست؛ تکرار نکن.
    await this.alerts.save(
      this.alerts.create({ sensorId: sensor.id, kind, value, message: message.slice(0, 300) }),
    );
  }

  async listAlerts(
    workspaceId: string,
    opts: { includeAcknowledged?: boolean } = {},
  ) {
    const sensorIds = (await this.sensors.find({ where: { workspaceId }, select: { id: true } })).map(
      (s) => s.id,
    );
    if (sensorIds.length === 0) return [];
    const qb = this.alerts
      .createQueryBuilder('a')
      .where('a.sensorId IN (:...ids)', { ids: sensorIds });
    if (!opts.includeAcknowledged) qb.andWhere('a.acknowledgedAt IS NULL');
    return qb.orderBy('a.createdAt', 'DESC').take(500).getMany();
  }

  async acknowledgeAlert(workspaceId: string, alertId: string, user: JwtUser) {
    const alert = await this.alerts.findOne({ where: { id: alertId } });
    if (!alert) throw new NotFoundException('هشدار یافت نشد');
    // مالکیت: سنسورِ هشدار باید در همین فضای کاری باشد.
    const sensor = await this.sensors.findOne({
      where: { id: alert.sensorId, workspaceId },
    });
    if (!sensor) throw new NotFoundException('هشدار یافت نشد');
    if (!alert.acknowledgedAt) {
      alert.acknowledgedAt = new Date();
      alert.acknowledgedBy = (user.email ?? '').slice(0, 160);
      await this.alerts.save(alert);
    }
    return alert;
  }

  // ── poll خودکار ────────────────────────────────────────────────────────────

  /** یک دور خواندنِ سنسورهای فعال + بررسی کهنگی. برای تست هم صدا زدنی است. */
  async poll(now = new Date()): Promise<number> {
    let read = 0;
    try {
      const active = await this.sensors.find({ where: { isActive: true } });
      for (const sensor of active) {
        if (
          sensor.connector === SensorConnectorKind.HTTP ||
          sensor.connector === SensorConnectorKind.SIMULATED
        ) {
          const result = await connectorFor(sensor.connector).read(sensor);
          if (result) {
            await this.ingest(sensor, result);
            read += 1;
          }
        }
        await this.checkStale(sensor, now);
      }
    } catch (error) {
      this.logger.warn(`poll سنسورها ناموفق: ${(error as Error).message}`);
    }
    return read;
  }

  private async checkStale(sensor: ColdRoomSensorEntity, now: Date) {
    const last = sensor.lastReadingAt ? new Date(sensor.lastReadingAt).getTime() : 0;
    const stale = now.getTime() - last > sensor.staleAfterSeconds * 1000;
    if (last > 0 && stale && sensor.lastHealth !== SensorHealth.STALE) {
      sensor.lastHealth = SensorHealth.STALE;
      await this.sensors.save(sensor);
      await this.raiseAlert(sensor, SensorAlertKind.STALE, null,
        `سنسور «${sensor.name}» بیش از ${sensor.staleAfterSeconds} ثانیه داده‌ی تازه نداده است`);
    }
  }

  private async ensureSensor(workspaceId: string, sensorId: string) {
    const sensor = await this.sensors.findOne({ where: { id: sensorId, workspaceId } });
    if (!sensor) throw new NotFoundException('سنسور یافت نشد');
    return sensor;
  }
}

function nullableNum(v: number | null | undefined): number | null {
  if (v === null || v === undefined || !Number.isFinite(Number(v))) return null;
  return Number(v);
}

function clampInt(v: number | undefined, min: number, max: number, def: number): number {
  const n = Math.trunc(Number(v));
  if (!Number.isFinite(n)) return def;
  return Math.min(Math.max(n, min), max);
}

/**
 * رمزنگاری رازِ پیکربندی (token) پیش از ذخیره. مقدار «" "» یا نبودِ token یعنی
 * دست‌نزدن به token قبلی هنگام به‌روزرسانی.
 */
function encryptConfig(
  config: Record<string, unknown> | undefined,
  previous?: Record<string, unknown>,
): Record<string, unknown> {
  const next: Record<string, unknown> = { ...(config ?? {}) };
  if (next.token === undefined || next.token === '') {
    // token تازه داده نشده؛ قبلی را نگه دار.
    if (previous && typeof previous.token === 'string') next.token = previous.token;
    else delete next.token;
  } else if (typeof next.token === 'string') {
    next.token = encryptSecret(next.token);
  }
  return next;
}
