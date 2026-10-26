jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import { BadRequestException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { HotelRoomEntity } from '../database/entities/hotel-room.entity';
import { createTestDataSource } from '../testing/test-database';
import { RoomsService } from './rooms.service';

const ORG = 'org-1';

describe('RoomsService', () => {
  let ds: DataSource;
  let service: RoomsService;

  beforeEach(async () => {
    ds = await createTestDataSource();
    service = new RoomsService(ds.getRepository(HotelRoomEntity));
  });

  it('اتاق می‌سازد و فهرست مرتب برمی‌گرداند', async () => {
    await service.create(ORG, { number: '305', floor: 3 });
    await service.create(ORG, { number: '101', floor: 1 });
    const list = await service.list(ORG);
    expect(list.map((r) => r.number)).toEqual(['101', '305']);
  });

  it('شماره اتاق تکراری در یک سازمان رد می‌شود', async () => {
    await service.create(ORG, { number: '101', floor: 1 });
    await expect(service.create(ORG, { number: '101' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('همان شماره در سازمان دیگر مجاز است', async () => {
    await service.create(ORG, { number: '101' });
    const other = await service.create('org-2', { number: '101' });
    expect(other.number).toBe('101');
  });

  it('ساخت گروهی برای ۱۶ طبقه و ۱۲ اتاق، ۱۹۲ اتاق می‌سازد', async () => {
    const res = await service.bulkCreate(ORG, {
      floors: 16,
      roomsPerFloor: 12,
    });
    expect(res.created).toBe(192);
    const list = await service.list(ORG);
    expect(list).toHaveLength(192);
    // طبقه ۳ اتاق ۵ با ضریبِ پیش‌فرض ۱۰۰ می‌شود ۳۰۵.
    expect(list.some((r) => r.number === '305' && r.floor === 3)).toBe(true);
    expect(list.some((r) => r.number === '1612' && r.floor === 16)).toBe(true);
  });

  it('ساخت گروهیِ دوباره اتاق‌های موجود را رد می‌کند، نه اینکه بشکند', async () => {
    await service.bulkCreate(ORG, { floors: 2, roomsPerFloor: 3 });
    const again = await service.bulkCreate(ORG, { floors: 2, roomsPerFloor: 3 });
    expect(again.created).toBe(0);
    expect(again.skipped).toBe(6);
  });

  it('ویرایش به شماره‌ی اتاقِ موجودِ دیگر رد می‌شود', async () => {
    await service.create(ORG, { number: '101' });
    const r2 = await service.create(ORG, { number: '102' });
    await expect(
      service.update(ORG, r2.id, { number: '101' }),
    ).rejects.toThrow('از قبل هست');
  });

  it('اتاقِ سازمان دیگر را نمی‌شود ویرایش یا حذف کرد', async () => {
    const mine = await service.create(ORG, { number: '101' });
    await expect(
      service.update('org-2', mine.id, { kind: 'سوئیت' }),
    ).rejects.toThrow('یافت نشد');
    await expect(service.remove('org-2', mine.id)).rejects.toThrow('یافت نشد');
  });

  it('اقلام/دارایی اتاق ذخیره و خوانده می‌شود', async () => {
    const room = await service.create(ORG, {
      number: '201',
      assets: [{ name: 'تلویزیون', serial: 'TV-9' }],
    });
    const fetched = (await service.list(ORG)).find((r) => r.id === room.id)!;
    expect(fetched.assets).toEqual([{ name: 'تلویزیون', serial: 'TV-9' }]);
  });
});
