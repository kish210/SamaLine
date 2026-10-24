jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
  InjectDataSource: () => () => undefined,
  TypeOrmModule: { forFeature: () => ({}), forRoot: () => ({}) },
}));

import type { DataSource } from 'typeorm';
import {
  MaintenanceCategory,
  MaintenancePriority,
  MaintenanceRequestEntity,
  MaintenanceStatus,
} from '../database/entities/maintenance-request.entity';
import { MaintenanceEventEntity } from '../database/entities/maintenance-event.entity';
import {
  RoomReadinessEntity,
  RoomReadinessStatus,
} from '../database/entities/room-readiness.entity';
import { createTestDataSource } from '../testing/test-database';
import { MaintenanceService } from './maintenance.service';

const user = (over: Record<string, unknown> = {}) =>
  ({ sub: 'u1', email: 'tech@hotel.local', organizationId: 'o1', workspaceId: 'w1', ...over }) as never;

const tenantStub = { assertWorkspace: async () => undefined } as never;

describe('MaintenanceService — ماژول نگهداری هتل', () => {
  let ds: DataSource;
  let service: MaintenanceService;
  const WS = 'w1';

  beforeEach(async () => {
    ds = await createTestDataSource();
    service = new MaintenanceService(
      ds.getRepository(MaintenanceRequestEntity),
      ds.getRepository(MaintenanceEventEntity),
      ds.getRepository(RoomReadinessEntity),
      tenantStub,
      ds,
    );
  });

  afterEach(async () => {
    await ds.destroy();
  });

  describe('درخواست‌ها', () => {
    it('درخواست با شماره‌ی ترتیبی و وضعیت new و رویداد created ساخته می‌شود', async () => {
      const r = await service.createRequest(WS, user(), {
        description: 'شیر آب چکه می‌کند',
        category: MaintenanceCategory.PLUMBING,
        priority: MaintenancePriority.URGENT,
        room: '101',
      });
      expect(r.requestNo).toBe('1');
      expect(r.status).toBe(MaintenanceStatus.NEW);
      const { history } = await service.getRequest(WS, r.id);
      expect(history.map((h) => h.action)).toContain('created');
    });

    it('شماره‌ی درخواست در هر فضای کاری جدا و ترتیبی است', async () => {
      await service.createRequest(WS, user(), { description: 'الف' });
      const second = await service.createRequest(WS, user(), { description: 'ب' });
      expect(second.requestNo).toBe('2');
      // فضای کاری دیگر از ۱ شروع می‌کند.
      const other = await service.createRequest('w2', user({ workspaceId: 'w2' }), {
        description: 'ج',
      });
      expect(other.requestNo).toBe('1');
    });

    it('تغییر وضعیت به done رویداد می‌سازد و closedAt را پر می‌کند', async () => {
      const r = await service.createRequest(WS, user(), { description: 'x' });
      const updated = await service.updateRequest(WS, user(), r.id, {
        status: MaintenanceStatus.DONE,
        completionNotes: 'تعویض شد',
      });
      expect(updated.closedAt).not.toBeNull();
      const { history } = await service.getRequest(WS, r.id);
      expect(history.some((h) => h.action === 'status_changed' && h.toValue === 'done')).toBe(true);
    });

    it('بایگانی حذف نرم است و از فهرست پیش‌فرض خارج می‌شود ولی تاریخچه می‌ماند', async () => {
      const r = await service.createRequest(WS, user(), { description: 'x' });
      await service.archiveRequest(WS, user(), r.id);
      const list = await service.listRequests(WS);
      expect(list.find((x) => x.id === r.id)).toBeUndefined();
      const withArchived = await service.listRequests(WS, { includeArchived: true });
      expect(withArchived.find((x) => x.id === r.id)).toBeDefined();
      // رکورد و تاریخچه هنوز هست (حذف سخت نشده).
      const { request, history } = await service.getRequest(WS, r.id);
      expect(request.archivedAt).not.toBeNull();
      expect(history.some((h) => h.action === 'archived')).toBe(true);
    });

    it('واگذاری به فنی‌کار رویداد assigned می‌سازد', async () => {
      const r = await service.createRequest(WS, user(), { description: 'x' });
      await service.updateRequest(WS, user(), r.id, { assignedTo: 'علی' });
      const { history } = await service.getRequest(WS, r.id);
      expect(history.some((h) => h.action === 'assigned' && h.toValue === 'علی')).toBe(true);
    });
  });

  describe('داشبورد با داده‌ی واقعی', () => {
    it('شمارش‌ها از رکوردهای واقعی می‌آید', async () => {
      await service.createRequest(WS, user(), {
        description: 'a',
        priority: MaintenancePriority.EMERGENCY,
      });
      const r2 = await service.createRequest(WS, user(), { description: 'b' });
      await service.updateRequest(WS, user(), r2.id, { status: MaintenanceStatus.WAITING_PART });

      const d = await service.dashboard(WS);
      expect(d.totals.total).toBe(2);
      expect(d.totals.urgent).toBe(1); // emergency هم اورژانسی شمرده می‌شود
      expect(d.totals.waitingPart).toBe(1);
      expect(d.totals.unassigned).toBe(2); // هنوز به کسی واگذار نشده
      expect(d.byStatus.reduce((s, x) => s + x.count, 0)).toBe(2);
    });
  });

  describe('آماده‌بودن اتاق — مستقل از وضعیت تیکت', () => {
    it('بستن درخواست، اتاق را خودکار آماده نمی‌کند', async () => {
      const r = await service.createRequest(WS, user(), { description: 'x', room: '205' });
      await service.setRoomReadiness(WS, user(), {
        room: '205',
        status: RoomReadinessStatus.NEEDS_INSPECTION,
      });
      // تیکت را می‌بندیم.
      await service.updateRequest(WS, user(), r.id, { status: MaintenanceStatus.DONE });
      const rooms = await service.listRooms(WS);
      const room = rooms.find((x) => x.room === '205');
      // آماده‌بودن دست‌نخورده مانده؛ بسته‌شدن تیکت آن را عوض نکرده.
      expect(room?.status).toBe(RoomReadinessStatus.NEEDS_INSPECTION);
    });

    it('تعیین آماده‌بودن upsert است و آخرین تغییرکننده را ثبت می‌کند', async () => {
      await service.setRoomReadiness(WS, user(), { room: '301', status: RoomReadinessStatus.NOT_READY });
      const updated = await service.setRoomReadiness(WS, user({ email: 'housekeeping@hotel.local' }), {
        room: '301',
        status: RoomReadinessStatus.READY,
        note: 'بازبینی شد',
      });
      expect(updated.status).toBe(RoomReadinessStatus.READY);
      expect(updated.updatedByName).toBe('housekeeping@hotel.local');
      const rooms = await service.listRooms(WS);
      expect(rooms.filter((x) => x.room === '301')).toHaveLength(1); // upsert، نه رکورد دوم
    });
  });
});
