jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import type { DataSource } from 'typeorm';
import { createTestDataSource } from '../testing/test-database';
import { AssetEntity } from '../database/entities/asset.entity';
import { MaintenanceRequestEntity } from '../database/entities/maintenance-request.entity';
import {
  WorkOrderEntity,
  WorkOrderStatus,
  WorkOrderTechnicianEntity,
} from '../database/entities/work-order.entity';
import { PersonnelEntity } from '../database/entities/personnel.entity';
import {
  HotelRoomEntity,
  RoomReadiness,
} from '../database/entities/hotel-room.entity';
import {
  PmInterval,
  PmScheduleEntity,
} from '../database/entities/pm-schedule.entity';
import { CmmsService } from './cmms.service';
import { PmService, addDays, intervalDaysOf } from './pm.service';

const ORG = 'org-1';

/** تاریخِ ISO با فاصله‌ی روز از امروز. */
const day = (offset: number) =>
  new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

describe('PmService', () => {
  let ds: DataSource;
  let cmms: CmmsService;
  let pm: PmService;

  beforeEach(async () => {
    ds = await createTestDataSource();
    cmms = new CmmsService(
      ds.getRepository(AssetEntity),
      ds.getRepository(MaintenanceRequestEntity),
      ds.getRepository(WorkOrderEntity),
      ds.getRepository(WorkOrderTechnicianEntity),
      ds.getRepository(PersonnelEntity),
      ds.getRepository(HotelRoomEntity),
      ds,
    );
    pm = new PmService(ds.getRepository(PmScheduleEntity), cmms);
  });

  afterEach(async () => {
    await ds.destroy();
  });

  it('طولِ دوره را درست حساب می‌کند', () => {
    expect(intervalDaysOf({ interval: PmInterval.WEEKLY, intervalDays: 0 })).toBe(7);
    expect(intervalDaysOf({ interval: PmInterval.ANNUAL, intervalDays: 0 })).toBe(365);
    // دوره‌ی دلخواه از ستونِ خودش می‌خواند.
    expect(intervalDaysOf({ interval: PmInterval.CUSTOM, intervalDays: 45 })).toBe(45);
    // دلخواهِ صفر بی‌معناست؛ دست‌کم یک روز.
    expect(intervalDaysOf({ interval: PmInterval.CUSTOM, intervalDays: 0 })).toBe(1);
  });

  it('addDays تاریخ را درست جلو می‌برد', () => {
    expect(addDays('2026-03-01', 3)).toBe('2026-03-04');
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
  });

  it('دوره‌ی دلخواهِ کمتر از یک روز رد می‌شود', async () => {
    await expect(
      pm.create(ORG, {
        title: 'بد',
        interval: PmInterval.CUSTOM,
        intervalDays: 0,
      }),
    ).rejects.toThrow('دست‌کم ۱ روز');
  });

  it('موعدِ اول از امروز یک دوره جلوتر است', async () => {
    const s = await pm.create(ORG, {
      title: 'سرویسِ ماهانه',
      interval: PmInterval.MONTHLY,
    });
    expect(s.nextDueAt).toBe(addDays(day(0), 30));
  });

  it('برنامهٔ سررسیده دستورِ کار می‌سازد و موعد را جلو می‌برد', async () => {
    const asset = await cmms.createAsset(ORG, { code: 'A-1', name: 'چیلر' });
    const s = await pm.create(ORG, {
      title: 'سرویسِ چیلر',
      assetId: asset.id,
      interval: PmInterval.WEEKLY,
      nextDueAt: day(-1),
      checklist: [{ text: 'تعویضِ فیلتر', done: false }],
      technicianIds: ['tech-1'],
    });

    const made = await pm.run();
    expect(made).toBe(1);

    // دستورِ کار واقعاً ساخته شده و چک‌لیست/تکنسین رویش کپی شده.
    const orders = await cmms.listWorkOrders(ORG, {});
    expect(orders.total).toBe(1);
    const full = await cmms.getWorkOrder(ORG, orders.rows[0].id);
    expect(full.checklist).toHaveLength(1);
    expect(full.technicians).toHaveLength(1);
    // موعدِ دستورِ کار همان موعدِ برنامه است تا «عقب‌افتاده» معنا بدهد.
    expect(full.dueDate).toBe(day(-1));

    const after = await pm.get(ORG, s.id);
    expect(after.lastWorkOrderId).toBe(orders.rows[0].id);
    // موعدِ بعدی باید در آینده باشد.
    expect(after.nextDueAt > day(0)).toBe(true);
  });

  it('برنامه‌ی خیلی عقب‌مانده فقط یک دستورِ کار می‌سازد و موعد به آینده می‌رود', async () => {
    await pm.create(ORG, {
      title: 'خیلی عقب',
      interval: PmInterval.DAILY,
      nextDueAt: day(-10),
    });

    const made = await pm.run();
    expect(made).toBe(1);
    // یک دستورِ کار، نه ده تا؛ وگرنه صفِ کار با تکرار پر می‌شد.
    expect((await cmms.listWorkOrders(ORG, {})).total).toBe(1);

    const rows = await pm.list(ORG);
    expect(rows[0].nextDueAt > day(0)).toBe(true);
  });

  it('برنامهٔ غیرفعال اجرا نمی‌شود', async () => {
    const s = await pm.create(ORG, {
      title: 'خاموش',
      interval: PmInterval.DAILY,
      nextDueAt: day(-1),
    });
    await pm.update(ORG, s.id, { isActive: false });

    expect(await pm.run()).toBe(0);
    expect((await cmms.listWorkOrders(ORG, {})).total).toBe(0);
  });

  it('خلاصه تعدادِ سررسیده و فعال را می‌دهد', async () => {
    await pm.create(ORG, {
      title: 'سررسیده',
      interval: PmInterval.DAILY,
      nextDueAt: day(-1),
    });
    await pm.create(ORG, {
      title: 'آینده',
      interval: PmInterval.MONTHLY,
      nextDueAt: day(20),
    });

    const sum = await pm.summary(ORG);
    expect(sum.dueNow).toBe(1);
    expect(sum.active).toBe(2);
  });
});

describe('آمادگیِ اتاق', () => {
  let ds: DataSource;
  let cmms: CmmsService;
  let rooms: ReturnType<DataSource['getRepository']>;

  const addRoom = async (): Promise<string> => {
    const saved = await rooms.save({
      organizationId: ORG,
      number: '203',
      floor: 2,
    });
    return (saved as { id: string }).id;
  };

  beforeEach(async () => {
    ds = await createTestDataSource();
    rooms = ds.getRepository(HotelRoomEntity);
    cmms = new CmmsService(
      ds.getRepository(AssetEntity),
      ds.getRepository(MaintenanceRequestEntity),
      ds.getRepository(WorkOrderEntity),
      ds.getRepository(WorkOrderTechnicianEntity),
      ds.getRepository(PersonnelEntity),
      rooms as never,
      ds,
    );
  });

  afterEach(async () => {
    await ds.destroy();
  });

  it('تکمیلِ کار اتاق را آماده نمی‌کند؛ به بازرسی می‌رود', async () => {
    const roomId = await addRoom();
    const wo = await cmms.createWorkOrder(ORG, {
      title: 'تعمیرِ حمام',
      roomId,
      technicianIds: ['t1'],
    });

    await cmms.changeWorkOrderStatus(ORG, wo.id, WorkOrderStatus.IN_PROGRESS);
    let room = await rooms.findOne({ where: { id: roomId } });
    expect((room as { readiness: string }).readiness).toBe(
      RoomReadiness.UNDER_MAINTENANCE,
    );

    await cmms.changeWorkOrderStatus(ORG, wo.id, WorkOrderStatus.COMPLETED);
    room = await rooms.findOne({ where: { id: roomId } });
    // قاعده‌ی مهم: تمام‌شده ≠ آماده.
    expect((room as { readiness: string }).readiness).toBe(
      RoomReadiness.AWAITING_INSPECTION,
    );

    await cmms.changeWorkOrderStatus(ORG, wo.id, WorkOrderStatus.VERIFIED);
    room = await rooms.findOne({ where: { id: roomId } });
    expect((room as { readiness: string }).readiness).toBe(RoomReadiness.READY);
    // با آماده‌شدن، یادداشتِ علت پاک می‌شود.
    expect((room as { readinessNote: string }).readinessNote).toBe('');
  });

  it('منتظرِ قطعه اتاق را از سرویس خارج می‌کند', async () => {
    const roomId = await addRoom();
    const wo = await cmms.createWorkOrder(ORG, {
      title: 'نشتی',
      roomId,
      technicianIds: ['t1'],
    });
    await cmms.changeWorkOrderStatus(ORG, wo.id, WorkOrderStatus.IN_PROGRESS);
    await cmms.changeWorkOrderStatus(
      ORG,
      wo.id,
      WorkOrderStatus.WAITING_PARTS,
    );

    const room = await rooms.findOne({ where: { id: roomId } });
    expect((room as { readiness: string }).readiness).toBe(
      RoomReadiness.OUT_OF_SERVICE,
    );
    expect((room as { readinessNote: string }).readinessNote).toContain('WO-');
  });

  it('تغییرِ دستیِ وضعیت ممکن است', async () => {
    const roomId = await addRoom();
    const saved = await cmms.setRoomReadiness(
      ORG,
      roomId,
      RoomReadiness.OUT_OF_SERVICE,
      'بازسازیِ کامل',
    );
    expect(saved.readiness).toBe(RoomReadiness.OUT_OF_SERVICE);
    expect(saved.readinessNote).toBe('بازسازیِ کامل');
  });
});
