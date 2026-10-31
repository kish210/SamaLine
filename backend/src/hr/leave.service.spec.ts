jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import type { DataSource } from 'typeorm';
import { createTestDataSource } from '../testing/test-database';
import {
  LeaveBalanceEntity,
  LeaveRequestEntity,
  LeaveStatus,
  LeaveType,
} from '../database/entities/leave-request.entity';
import {
  EmploymentStatus,
  PersonnelEntity,
} from '../database/entities/personnel.entity';
import { LeaveService, countDays } from './leave.service';

const ORG = 'org-1';
const OTHER_ORG = 'org-2';

/** تاریخِ ISO با فاصله‌ی روز از امروز. */
const day = (offset: number) =>
  new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

describe('LeaveService', () => {
  let ds: DataSource;
  let service: LeaveService;
  let people: ReturnType<DataSource['getRepository']>;

  const addPerson = async (
    organizationId = ORG,
    fullName = 'علی رضایی',
  ): Promise<string> => {
    const saved = await people.save({ organizationId, fullName, mobile: '' });
    return (saved as { id: string }).id;
  };

  beforeEach(async () => {
    ds = await createTestDataSource();
    people = ds.getRepository(PersonnelEntity);
    service = new LeaveService(
      ds.getRepository(LeaveRequestEntity),
      ds.getRepository(LeaveBalanceEntity),
      ds.getRepository(PersonnelEntity),
    );
  });

  afterEach(async () => {
    await ds.destroy();
  });

  it('شمارشِ روز هر دو سرِ بازه را حساب می‌کند', () => {
    expect(countDays('2026-03-01', '2026-03-01')).toBe(1);
    expect(countDays('2026-03-01', '2026-03-03')).toBe(3);
    // پایانِ پیش از شروع بی‌معناست.
    expect(countDays('2026-03-05', '2026-03-01')).toBe(0);
  });

  it('ثبتِ مرخصی شماره و تعدادِ روز می‌سازد', async () => {
    const id = await addPerson();
    const leave = await service.create(ORG, {
      personnelId: id,
      fromDate: day(3),
      toDate: day(5),
      reason: 'سفر',
    });
    expect(leave.number).toMatch(/^LV-/);
    expect(leave.days).toBe(3);
    expect(leave.status).toBe(LeaveStatus.PENDING);
  });

  it('بازه‌ی برعکس رد می‌شود', async () => {
    const id = await addPerson();
    await expect(
      service.create(ORG, {
        personnelId: id,
        fromDate: day(5),
        toDate: day(2),
      }),
    ).rejects.toThrow('پیش از شروع');
  });

  it('مرخصیِ هم‌پوشان ثبت نمی‌شود', async () => {
    const id = await addPerson();
    await service.create(ORG, {
      personnelId: id,
      fromDate: day(2),
      toDate: day(6),
    });
    await expect(
      service.create(ORG, {
        personnelId: id,
        fromDate: day(4),
        toDate: day(8),
      }),
    ).rejects.toThrow('ثبت‌شده یا در انتظار');
  });

  it('پرسنلِ سازمانِ دیگر مرخصی نمی‌گیرد', async () => {
    const other = await addPerson(OTHER_ORG, 'غریبه');
    await expect(
      service.create(ORG, {
        personnelId: other,
        fromDate: day(1),
        toDate: day(2),
      }),
    ).rejects.toThrow('یافت نشد');
  });

  it('تأیید و ردِ مرخصی با تاریخچه ثبت می‌شود', async () => {
    const id = await addPerson();
    const leave = await service.create(ORG, {
      personnelId: id,
      fromDate: day(3),
      toDate: day(4),
    });
    const approved = await service.decide(
      ORG,
      leave.id,
      LeaveStatus.APPROVED,
      { actorId: 'mgr-1', note: 'موافقم' },
    );
    expect(approved.status).toBe(LeaveStatus.APPROVED);
    expect(approved.decidedByUserId).toBe('mgr-1');
    expect(approved.history).toHaveLength(1);

    // تأییدشده دیگر رد نمی‌شود.
    await expect(
      service.decide(ORG, leave.id, LeaveStatus.REJECTED),
    ).rejects.toThrow('مجاز نیست');
  });

  it('تأییدِ مرخصیِ جاری وضعیتِ کارمند را «در مرخصی» می‌کند', async () => {
    const id = await addPerson();
    const leave = await service.create(ORG, {
      personnelId: id,
      fromDate: day(-1),
      toDate: day(1),
    });
    await service.decide(ORG, leave.id, LeaveStatus.APPROVED);
    const person = await people.findOne({ where: { id } });
    expect((person as { employmentStatus: string }).employmentStatus).toBe(
      EmploymentStatus.ON_LEAVE,
    );
  });

  it('مرخصیِ آینده وضعیتِ کارمند را عوض نمی‌کند', async () => {
    const id = await addPerson();
    const leave = await service.create(ORG, {
      personnelId: id,
      fromDate: day(10),
      toDate: day(12),
    });
    await service.decide(ORG, leave.id, LeaveStatus.APPROVED);
    const person = await people.findOne({ where: { id } });
    expect((person as { employmentStatus: string }).employmentStatus).toBe(
      EmploymentStatus.ACTIVE,
    );
  });

  it('مانده = سقف منهای مصرفِ تأییدشده', async () => {
    const id = await addPerson();
    const year = new Date().getFullYear();
    await service.setBalance(ORG, {
      personnelId: id,
      year,
      entitledDays: 26,
    });

    const l1 = await service.create(ORG, {
      personnelId: id,
      fromDate: day(2),
      toDate: day(4),
    });
    await service.decide(ORG, l1.id, LeaveStatus.APPROVED);

    // مرخصیِ در انتظار نباید از مانده کم شود.
    await service.create(ORG, {
      personnelId: id,
      fromDate: day(20),
      toDate: day(21),
    });

    const balance = await service.balanceOf(ORG, id, year);
    const annual = balance.find((b) => b.type === LeaveType.ANNUAL);
    expect(annual?.entitled).toBe(26);
    expect(annual?.used).toBe(3);
    expect(annual?.remaining).toBe(23);
  });

  it('خلاصهٔ HR سطل‌های قابلِ‌اقدام می‌دهد', async () => {
    const id = await addPerson();
    await service.create(ORG, {
      personnelId: id,
      fromDate: day(5),
      toDate: day(6),
    });
    // قراردادِ رو به پایان.
    await people.update({ id }, { contractEndsAt: day(10) });

    const sum = await service.summary(ORG);
    const byKey = Object.fromEntries(sum.buckets.map((b) => [b.key, b]));
    expect(byKey.pendingLeaves.count).toBe(1);
    expect(byKey.contractsExpiring.count).toBe(1);
    expect(sum.headcount).toBe(1);
  });

  it('فهرست با نامِ پرسنل برمی‌گردد و سازمانِ دیگر را نشان نمی‌دهد', async () => {
    const mine = await addPerson(ORG, 'زهرا محمدی');
    const other = await addPerson(OTHER_ORG, 'غریبه');
    await service.create(ORG, {
      personnelId: mine,
      fromDate: day(1),
      toDate: day(2),
    });
    await service.create(OTHER_ORG, {
      personnelId: other,
      fromDate: day(1),
      toDate: day(2),
    });

    const list = await service.list(ORG, {});
    expect(list.total).toBe(1);
    expect(list.rows[0].personnelName).toBe('زهرا محمدی');
  });
});
