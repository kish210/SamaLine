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
import { MaintenancePriority } from '../database/entities/maintenance-request.entity';
import { PersonnelEntity } from '../database/entities/personnel.entity';
import { PersonnelBotLinkEntity } from '../database/entities/personnel-bot-link.entity';
import {
  HotelRoomEntity,
  RoomReadiness,
} from '../database/entities/hotel-room.entity';
import {
  SparePartEntity,
  StockMovementEntity,
} from '../database/entities/spare-part.entity';
import {
  AttendanceRecordEntity,
  ShiftAssignmentEntity,
  ShiftTemplateEntity,
} from '../database/entities/work-shift.entity';
import {
  LeaveBalanceEntity,
  LeaveRequestEntity,
  LeaveStatus,
  LeaveType,
} from '../database/entities/leave-request.entity';
import { CmmsService } from '../cmms/cmms.service';
import { InventoryService } from '../cmms/inventory.service';
import { ShiftService, todayIso } from '../hr/shift.service';
import { LeaveService } from '../hr/leave.service';
import { HrService } from '../hr/hr.service';
import { CommandCenterService } from './command-center.service';

const ORG = 'org-1';
const OTHER_ORG = 'org-2';

describe('CommandCenterService', () => {
  let ds: DataSource;
  let desk: CommandCenterService;
  let cmms: CmmsService;
  let inventory: InventoryService;
  let shifts: ShiftService;
  let leaves: LeaveService;
  let hr: HrService;

  /** شکلِ تخت از کاشی‌ها: «بخش.کاشی» → عدد. */
  const tilesOf = async (organizationId = ORG) => {
    const result = await desk.desk(organizationId);
    const map: Record<string, number> = {};
    for (const section of result.sections) {
      for (const tile of section.tiles) {
        map[`${section.key}.${tile.key}`] = tile.count;
      }
    }
    return { result, map };
  };

  beforeEach(async () => {
    ds = await createTestDataSource();
    const rooms = ds.getRepository(HotelRoomEntity);

    cmms = new CmmsService(
      ds.getRepository(AssetEntity),
      ds.getRepository(MaintenanceRequestEntity),
      ds.getRepository(WorkOrderEntity),
      ds.getRepository(WorkOrderTechnicianEntity),
      ds.getRepository(PersonnelEntity),
      rooms,
      ds,
    );
    inventory = new InventoryService(
      ds.getRepository(SparePartEntity),
      ds.getRepository(StockMovementEntity),
      ds.getRepository(WorkOrderEntity),
      ds,
    );
    shifts = new ShiftService(
      ds.getRepository(ShiftTemplateEntity),
      ds.getRepository(ShiftAssignmentEntity),
      ds.getRepository(AttendanceRecordEntity),
      ds.getRepository(PersonnelEntity),
      ds.getRepository(LeaveRequestEntity),
    );
    leaves = new LeaveService(
      ds.getRepository(LeaveRequestEntity),
      ds.getRepository(LeaveBalanceEntity),
      ds.getRepository(PersonnelEntity),
    );
    hr = new HrService(
      ds.getRepository(PersonnelEntity),
      ds.getRepository(PersonnelBotLinkEntity),
    );

    desk = new CommandCenterService(cmms, inventory, shifts, leaves, rooms);
  });

  afterEach(async () => {
    await ds.destroy();
  });

  it('هتلِ آرام فهرستِ «توجه می‌خواهد» خالی دارد', async () => {
    const { result } = await tilesOf();
    // فهرستِ خالی یعنی واقعاً چیزی معلق نیست، نه اینکه داده نداریم.
    expect(result.attention).toHaveLength(0);
    expect(result.degraded).toHaveLength(0);
  });

  it('کارِ اضطراری و عقب‌افتاده در صدرِ فهرستِ توجه می‌آیند', async () => {
    await cmms.createWorkOrder(ORG, {
      title: 'نشتیِ گاز',
      priority: MaintenancePriority.EMERGENCY,
      technicianIds: ['t1'],
    });
    await cmms.createRequest(ORG, { title: 'لامپِ سوخته' });

    const { result, map } = await tilesOf();
    expect(map['technical.emergency']).toBe(1);
    expect(map['technical.newRequests']).toBe(1);

    // اضطراری (danger) باید پیش از درخواستِ جدید (info) بیاید.
    expect(result.attention[0].key).toBe('emergency');
    expect(result.attention.map((a) => a.key)).toContain('newRequests');
    const emergency = result.attention[0];
    expect(emergency.tone).toBe('danger');
    // هر سطر مقصدِ واقعی دارد، وگرنه عددِ تزئینی می‌شد.
    expect(emergency.href).toContain('/operations');
  });

  it('حضورِ ثبت‌نشده‌ی امروز به میزِ کار می‌آید', async () => {
    const person = await hr.create(ORG, { fullName: 'شیفت‌دار' });
    await shifts.assign(ORG, {
      personnelId: person.id,
      date: todayIso(),
      startTime: '07:00',
      endTime: '15:00',
    });

    const { result, map } = await tilesOf();
    expect(map['workforce.scheduled']).toBe(1);
    expect(map['workforce.unrecorded']).toBe(1);
    expect(result.attention.map((a) => a.key)).toContain('unrecorded');
  });

  it('با ثبتِ حضور، هشدارِ ثبت‌نشده می‌رود', async () => {
    const person = await hr.create(ORG, { fullName: 'حاضر' });
    const today = todayIso();
    await shifts.assign(ORG, {
      personnelId: person.id,
      date: today,
      startTime: '07:00',
      endTime: '15:00',
    });
    await shifts.setAttendance(ORG, {
      personnelId: person.id,
      date: today,
      checkIn: '07:00',
    });

    const { result, map } = await tilesOf();
    expect(map['workforce.unrecorded']).toBe(0);
    expect(map['workforce.present']).toBe(1);
    expect(result.attention.map((a) => a.key)).not.toContain('unrecorded');
  });

  it('مرخصیِ منتظرِ تأیید و قراردادِ رو به پایان دیده می‌شوند', async () => {
    const person = await hr.create(ORG, { fullName: 'متقاضی' });
    await leaves.create(ORG, {
      personnelId: person.id,
      type: LeaveType.PAID,
      fromDate: '2026-04-01',
      toDate: '2026-04-02',
    });
    // قراردادی که تا ۳۰ روزِ آینده تمام می‌شود.
    const soon = new Date(Date.now() + 10 * 86400000)
      .toISOString()
      .slice(0, 10);
    await hr.update(ORG, person.id, { contractEndsAt: soon });

    const { result, map } = await tilesOf();
    expect(map['workforce.pendingLeave']).toBe(1);
    expect(map['workforce.contractEnding']).toBe(1);
    const keys = result.attention.map((a) => a.key);
    expect(keys).toContain('pendingLeave');
    expect(keys).toContain('contractEnding');
  });

  it('اتاقِ خارج از سرویس و منتظرِ بازرسی شمرده می‌شوند', async () => {
    const rooms = ds.getRepository(HotelRoomEntity);
    const room = await rooms.save({
      organizationId: ORG,
      number: '101',
      floor: 1,
    });
    const other = await rooms.save({
      organizationId: ORG,
      number: '102',
      floor: 1,
    });
    await cmms.setRoomReadiness(ORG, room.id, RoomReadiness.OUT_OF_SERVICE);
    await cmms.setRoomReadiness(
      ORG,
      other.id,
      RoomReadiness.AWAITING_INSPECTION,
    );

    const { result, map } = await tilesOf();
    expect(map['rooms.outOfService']).toBe(1);
    expect(map['rooms.awaitingInspection']).toBe(1);
    expect(map['rooms.ready']).toBe(0);

    const keys = result.attention.map((a) => a.key);
    expect(keys).toContain('roomsOut');
    expect(keys).toContain('roomsAwaitingInspection');
  });

  it('کارِ تمام‌شده روی اتاق، آن را «منتظرِ بازرسی» نشان می‌دهد', async () => {
    const rooms = ds.getRepository(HotelRoomEntity);
    const room = await rooms.save({
      organizationId: ORG,
      number: '203',
      floor: 2,
    });
    const wo = await cmms.createWorkOrder(ORG, {
      title: 'تعمیرِ حمام',
      roomId: room.id,
      technicianIds: ['t1'],
    });
    await cmms.changeWorkOrderStatus(ORG, wo.id, WorkOrderStatus.IN_PROGRESS);
    await cmms.changeWorkOrderStatus(ORG, wo.id, WorkOrderStatus.COMPLETED);

    const { map } = await tilesOf();
    // قاعده‌ی مهمِ CMMS تا روی داشبوردِ مدیر هم پیداست: تمام‌شده ≠ آماده.
    expect(map['rooms.awaitingInspection']).toBe(1);
    expect(map['rooms.ready']).toBe(0);
  });

  it('قطعهٔ زیرِ نقطهٔ سفارش به میزِ کار می‌آید', async () => {
    await inventory.createPart(ORG, {
      code: 'P-1',
      name: 'فیلتر',
      reorderLevel: 5,
      openingQuantity: 2,
      unitCost: 1000,
    });

    const { result, map } = await tilesOf();
    expect(map['inventory.lowStock']).toBe(1);
    expect(result.inventoryValue).toBe(2000);
    expect(result.attention.map((a) => a.key)).toContain('lowStock');
  });

  it('هیچ عددی از سازمانِ دیگر نمی‌آید', async () => {
    await cmms.createWorkOrder(OTHER_ORG, {
      title: 'مالِ غریبه',
      priority: MaintenancePriority.EMERGENCY,
      technicianIds: ['t1'],
    });
    await hr.create(OTHER_ORG, { fullName: 'غریبه' });
    await inventory.createPart(OTHER_ORG, {
      code: 'X-1',
      name: 'غریبه',
      reorderLevel: 9,
      openingQuantity: 0,
    });

    const { result } = await tilesOf(ORG);
    expect(result.attention).toHaveLength(0);
    expect(result.inventoryValue).toBe(0);
  });

  it('خطای یک بخش، کلِ میزِ کار را از کار نمی‌اندازد', async () => {
    const broken = new CommandCenterService(
      cmms,
      { summary: async () => Promise.reject(new Error('انبار خراب')) } as never,
      shifts,
      leaves,
      ds.getRepository(HotelRoomEntity),
    );
    await cmms.createWorkOrder(ORG, {
      title: 'کارِ اضطراری',
      priority: MaintenancePriority.EMERGENCY,
      technicianIds: ['t1'],
    });

    const result = await broken.desk(ORG);
    // بخشِ انبار غایب است و صریح اعلام می‌شود، ولی بقیه سرِ جایشان‌اند.
    expect(result.degraded).toContain('inventory');
    expect(result.sections.map((s) => s.key)).not.toContain('inventory');
    expect(result.sections.map((s) => s.key)).toContain('technical');
    expect(result.attention.map((a) => a.key)).toContain('emergency');
  });

  it('هر کاشی مقصدِ قابلِ‌کلیک دارد', async () => {
    await hr.create(ORG, { fullName: 'کسی' });
    const { result } = await tilesOf();
    const all = result.sections.flatMap((s) => s.tiles);
    expect(all.length).toBeGreaterThan(0);
    for (const tile of all) {
      expect(tile.href.startsWith('/')).toBe(true);
    }
  });
});
