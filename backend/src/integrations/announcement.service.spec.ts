jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import type { DataSource } from 'typeorm';
import { AnnouncementEntity } from '../database/entities/announcement.entity';
import { createTestDataSource } from '../testing/test-database';
import { AnnouncementService } from './announcement.service';

const ORG = 'org-1';

describe('AnnouncementService', () => {
  let ds: DataSource;
  let broadcasts: Array<Record<string, unknown>>;
  let service: AnnouncementService;

  beforeEach(async () => {
    ds = await createTestDataSource();
    broadcasts = [];
    const staffNotify = {
      broadcastAnnouncement: async (input: Record<string, unknown>) => {
        broadcasts.push(input);
        return { sent: 3, skipped: 1 };
      },
    } as never;
    service = new AnnouncementService(
      ds.getRepository(AnnouncementEntity),
      staffNotify,
    );
  });

  it('اطلاعیه را می‌فرستد و با شمارِ گیرنده ثبت می‌کند', async () => {
    const res = await service.create(ORG, 'mgr@hotel.ir', {
      title: 'جلسه',
      body: 'فردا ۹',
    });
    expect(res.sent).toBe(3);
    expect(res.announcement.recipientCount).toBe(3);
    expect(res.announcement.sentByEmail).toBe('mgr@hotel.ir');
    // دقیقا یک‌بار پخش شد.
    expect(broadcasts).toHaveLength(1);
    expect(broadcasts[0]).toMatchObject({ organizationId: ORG, title: 'جلسه' });
  });

  it('حتی بدونِ گیرنده هم ثبت می‌شود (تاریخچه مستقل از بله)', async () => {
    const staffNotify = {
      broadcastAnnouncement: async () => ({ sent: 0, skipped: 0 }),
    } as never;
    const svc = new AnnouncementService(
      ds.getRepository(AnnouncementEntity),
      staffNotify,
    );
    const res = await svc.create(ORG, 'm@x.ir', { title: 'x', body: 'y' });
    expect(res.announcement.recipientCount).toBe(0);
    expect(await svc.list(ORG)).toHaveLength(1);
  });

  it('فهرست را به ترتیبِ جدیدترین و فقط برای همان سازمان می‌دهد', async () => {
    await service.create(ORG, 'm@x.ir', { title: 'اول', body: 'a' });
    await service.create(ORG, 'm@x.ir', { title: 'دوم', body: 'b' });
    await service.create('org-2', 'm@x.ir', { title: 'غریبه', body: 'c' });

    const list = await service.list(ORG);
    expect(list).toHaveLength(2);
    expect(list[0].title).toBe('دوم');
    expect(list.every((a) => a.organizationId === ORG)).toBe(true);
  });

  it('بخشِ مقصد را نگه می‌دارد', async () => {
    const res = await service.create(ORG, 'm@x.ir', {
      title: 'فنی',
      body: 'z',
      departmentId: 'dept-9',
    });
    expect(res.announcement.departmentId).toBe('dept-9');
    expect(broadcasts[0].departmentId).toBe('dept-9');
  });
});
