jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
  TypeOrmModule: { forFeature: () => ({}), forRoot: () => ({}) },
}));

import type { DataSource } from 'typeorm';
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
import { createTestDataSource } from '../testing/test-database';
import { SensorsService } from './sensors.service';

const user = () =>
  ({ sub: 'u1', email: 'ops@hotel.local', organizationId: 'o1', workspaceId: 'w1' }) as never;
const tenantStub = { assertWorkspace: async () => undefined } as never;
const WS = 'w1';

describe('SensorsService — سنسور دمای سردخانه', () => {
  let ds: DataSource;
  let service: SensorsService;

  beforeEach(async () => {
    ds = await createTestDataSource();
    service = new SensorsService(
      ds.getRepository(ColdRoomSensorEntity),
      ds.getRepository(SensorReadingEntity),
      ds.getRepository(SensorAlertEntity),
      tenantStub,
    );
    // onModuleInit را صدا نمی‌زنیم تا تایمر poll در تست روشن نشود.
  });

  afterEach(async () => {
    await ds.destroy();
  });

  it('poll سنسور شبیه‌ساز قرائت می‌سازد که صریحاً آزمایشی علامت خورده', async () => {
    await service.create(WS, { name: 'سردخانه ۱', connector: SensorConnectorKind.SIMULATED });
    const n = await service.poll();
    expect(n).toBe(1);
    const sensors = await service.list(WS);
    const readings = await service.readingsFor(WS, sensors[0].id);
    expect(readings).toHaveLength(1);
    expect(readings[0].isSimulated).toBe(true); // هرگز با داده‌ی واقعی اشتباه نشود
    expect(sensors[0].lastValue).not.toBeNull();
  });

  it('قرائت بالاتر از حد مجاز هشدار high و سلامت HIGH می‌سازد', async () => {
    const s = await service.create(WS, {
      name: 'سردخانه ۲',
      connector: SensorConnectorKind.MANUAL,
      maxThreshold: -10,
    });
    await service.submitManualReading(WS, s.id, -5);
    const after = (await service.list(WS))[0];
    expect(after.lastHealth).toBe(SensorHealth.HIGH);
    const alerts = await service.listAlerts(WS);
    expect(alerts.some((a) => a.kind === SensorAlertKind.HIGH)).toBe(true);
  });

  it('هشدار باز تکراری نمی‌سازد (dedup)', async () => {
    const s = await service.create(WS, {
      name: 'سردخانه ۳',
      connector: SensorConnectorKind.MANUAL,
      minThreshold: -20,
    });
    await service.submitManualReading(WS, s.id, -25);
    await service.submitManualReading(WS, s.id, -26);
    const alerts = await service.listAlerts(WS);
    expect(alerts.filter((a) => a.kind === SensorAlertKind.LOW)).toHaveLength(1);
  });

  it('تأیید هشدار، آن را از فهرست باز خارج می‌کند', async () => {
    const s = await service.create(WS, {
      name: 'س۴', connector: SensorConnectorKind.MANUAL, maxThreshold: 0,
    });
    await service.submitManualReading(WS, s.id, 5);
    const open = await service.listAlerts(WS);
    expect(open).toHaveLength(1);
    const acked = await service.acknowledgeAlert(WS, open[0].id, user());
    expect(acked.acknowledgedAt).not.toBeNull();
    expect(acked.acknowledgedBy).toBe('ops@hotel.local');
    expect(await service.listAlerts(WS)).toHaveLength(0);
    expect(await service.listAlerts(WS, { includeAcknowledged: true })).toHaveLength(1);
  });

  it('سنسور کهنه (بدون داده‌ی تازه) هشدار stale می‌گیرد', async () => {
    const s = await service.create(WS, {
      name: 'س۵', connector: SensorConnectorKind.MANUAL, staleAfterSeconds: 60,
    });
    await service.submitManualReading(WS, s.id, -18);
    // آخرین قرائت را به گذشته می‌بریم تا کهنه شود.
    await ds.getRepository(ColdRoomSensorEntity).update(
      { id: s.id },
      { lastReadingAt: new Date(Date.now() - 3600 * 1000) },
    );
    await service.poll(new Date());
    const alerts = await service.listAlerts(WS);
    expect(alerts.some((a) => a.kind === SensorAlertKind.STALE)).toBe(true);
    expect((await service.list(WS))[0].lastHealth).toBe(SensorHealth.STALE);
  });

  it('سنسور دیگری‌ست؛ هشدار فقط در فضای کاری خودش دیده می‌شود', async () => {
    const s = await service.create(WS, {
      name: 's', connector: SensorConnectorKind.MANUAL, maxThreshold: 0,
    });
    await service.submitManualReading(WS, s.id, 9);
    expect(await service.listAlerts('other-ws')).toHaveLength(0);
  });
});
