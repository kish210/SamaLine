jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import { BadRequestException } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { PersonnelEntity } from '../database/entities/personnel.entity';
import { createTestDataSource } from '../testing/test-database';
import { HrService } from './hr.service';

const ORG = 'org-1';

describe('HrService', () => {
  let ds: DataSource;
  let service: HrService;

  beforeEach(async () => {
    ds = await createTestDataSource();
    service = new HrService(ds.getRepository(PersonnelEntity));
  });

  it('پرسنل می‌سازد و فهرستِ مرتب بر اساس نام برمی‌گرداند', async () => {
    await service.create(ORG, { fullName: 'زهرا محمدی' });
    await service.create(ORG, { fullName: 'احمد رضایی' });
    const list = await service.list(ORG);
    expect(list.map((p) => p.fullName)).toEqual(['احمد رضایی', 'زهرا محمدی']);
  });

  it('نام خالی رد می‌شود', async () => {
    await expect(service.create(ORG, { fullName: '  ' })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('موبایل را فقط رقم نگه می‌دارد و یکتاییِ سازمانی را اعمال می‌کند', async () => {
    const p = await service.create(ORG, {
      fullName: 'علی',
      mobile: '0912-345-6789',
    });
    expect(p.mobile).toBe('09123456789');
    await expect(
      service.create(ORG, { fullName: 'حسن', mobile: '0912 345 6789' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('همان موبایل در سازمان دیگر مجاز است', async () => {
    await service.create(ORG, { fullName: 'الف', mobile: '09120000000' });
    const other = await service.create('org-2', {
      fullName: 'ب',
      mobile: '09120000000',
    });
    expect(other.mobile).toBe('09120000000');
  });

  it('چند پرسنلِ بدونِ موبایل مجاز است', async () => {
    await service.create(ORG, { fullName: 'یک' });
    const two = await service.create(ORG, { fullName: 'دو' });
    expect(two.mobile).toBe('');
  });

  it('findByMobile پرسنل را با نگارشِ متفاوتِ موبایل پیدا می‌کند', async () => {
    const p = await service.create(ORG, {
      fullName: 'سارا',
      mobile: '09121112233',
    });
    const found = await service.findByMobile(ORG, '0912-111-2233');
    expect(found?.id).toBe(p.id);
    expect(await service.findByMobile('org-2', '09121112233')).toBeNull();
  });

  it('تاریخِ استخدامِ نامعتبر خالی می‌شود، معتبر می‌ماند', async () => {
    const bad = await service.create(ORG, {
      fullName: 'الف',
      hireDate: '1403/01/01',
    });
    expect(bad.hireDate).toBe('');
    const good = await service.create(ORG, {
      fullName: 'ب',
      hireDate: '2024-03-21',
    });
    expect(good.hireDate).toBe('2024-03-21');
  });

  it('مدارک/فایل‌ها ذخیره و خوانده می‌شود', async () => {
    const p = await service.create(ORG, {
      fullName: 'رضا',
      documents: [{ name: 'قرارداد', url: '/f/1.pdf' }],
    });
    const fetched = (await service.list(ORG)).find((x) => x.id === p.id)!;
    expect(fetched.documents).toEqual([{ name: 'قرارداد', url: '/f/1.pdf' }]);
  });

  it('پرسنلِ سازمان دیگر را نمی‌شود ویرایش یا حذف کرد', async () => {
    const mine = await service.create(ORG, { fullName: 'من' });
    await expect(
      service.update('org-2', mine.id, { position: 'سرایدار' }),
    ).rejects.toThrow('یافت نشد');
    await expect(service.remove('org-2', mine.id)).rejects.toThrow('یافت نشد');
  });
});
