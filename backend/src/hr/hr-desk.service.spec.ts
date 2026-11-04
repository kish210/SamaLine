jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import type { DataSource } from 'typeorm';
import { createTestDataSource } from '../testing/test-database';
import { OrganizationEntity } from '../database/entities/organization.entity';
import { DepartmentEntity } from '../database/entities/department.entity';
import {
  EmploymentStatus,
  PersonnelEntity,
} from '../database/entities/personnel.entity';
import {
  LeaveBalanceEntity,
  LeaveRequestEntity,
  LeaveStatus,
  LeaveType,
} from '../database/entities/leave-request.entity';
import {
  AttendanceRecordEntity,
  AttendanceSource,
  AttendanceStatus,
  ShiftAssignmentEntity,
  ShiftTemplateEntity,
} from '../database/entities/work-shift.entity';
import { ShiftService } from './shift.service';
import { LeaveService } from './leave.service';
import { HrDeskService } from './hr-desk.service';

/**
 * میزِ کارِ منابع انسانی.
 *
 * اعدادِ این صفحه باید همان اعدادِ صفحه‌های دیگر باشند؛ برای همین روی داده‌ی
 * واقعیِ همان جدول‌ها سنجیده می‌شود (نه ماک): یک نفر حاضر، یک نفر بی‌ثبت،
 * یک نفر در مرخصیِ تأییدشده، یک مرخصیِ معلق، و یک قراردادِ رو به پایان.
 */
describe('HrDeskService', () => {
  let ds: DataSource;
  let desk: HrDeskService;
  let leaves: LeaveService;
  let orgId: string;
  let techId: string;
  let housekeepingId: string;
  let farNameId: string;

  const DAY = '2026-05-10';

  beforeEach(async () => {
    ds = await createTestDataSource();
    const org = await ds.getRepository(OrganizationEntity).save({ name: 'هتل' });
    orgId = org.id;
    const tech = await ds
      .getRepository(DepartmentEntity)
      .save({ organizationId: orgId, name: 'فنی', key: 'technical' });
    techId = tech.id;
    const hk = await ds
      .getRepository(DepartmentEntity)
      .save({ organizationId: orgId, name: 'خانه‌داری', key: 'housekeeping' });
    housekeepingId = hk.id;

    const people = ds.getRepository(PersonnelEntity);
    const present = await people.save({
      organizationId: orgId,
      fullName: 'علی رضایی',
      mobile: '09120000001',
      departmentId: techId,
      employmentStatus: EmploymentStatus.ACTIVE,
      contractEndsAt: '2026-05-20',
    });
    const onLeave = await people.save({
      organizationId: orgId,
      fullName: 'مریم کریمی',
      mobile: '09120000002',
      departmentId: housekeepingId,
      employmentStatus: EmploymentStatus.ON_LEAVE,
    });
    const unrecordedPerson = await people.save({
      organizationId: orgId,
      fullName: 'سعید نوری',
      mobile: '09120000003',
      departmentId: techId,
      employmentStatus: EmploymentStatus.ACTIVE,
    });
    await people.save({
      organizationId: orgId,
      fullName: 'فردِ جدا شده',
      mobile: '09120000004',
      departmentId: techId,
      employmentStatus: EmploymentStatus.TERMINATED,
    });
    farNameId = present.id;

    await ds.getRepository(ShiftAssignmentEntity).save([
      {
        organizationId: orgId,
        personnelId: present.id,
        date: DAY,
        startTime: '07:00',
        endTime: '15:00',
      },
      {
        organizationId: orgId,
        personnelId: unrecordedPerson.id,
        date: DAY,
        startTime: '07:00',
        endTime: '15:00',
      },
    ]);
    await ds.getRepository(AttendanceRecordEntity).save({
      organizationId: orgId,
      personnelId: present.id,
      date: DAY,
      status: AttendanceStatus.PRESENT,
      checkIn: '07:00',
      checkOut: '15:00',
      minutesWorked: 480,
      source: AttendanceSource.MANUAL,
    });

    const leaveRepo = ds.getRepository(LeaveRequestEntity);
    await leaveRepo.save({
      organizationId: orgId,
      number: 'LV-1',
      personnelId: onLeave.id,
      departmentId: housekeepingId,
      type: LeaveType.ANNUAL,
      fromDate: '2026-05-09',
      toDate: '2026-05-11',
      days: 3,
      status: LeaveStatus.APPROVED,
      history: [],
    });
    await leaveRepo.save({
      organizationId: orgId,
      number: 'LV-2',
      personnelId: unrecordedPerson.id,
      departmentId: techId,
      type: LeaveType.SICK,
      fromDate: '2026-06-01',
      toDate: '2026-06-02',
      days: 2,
      status: LeaveStatus.PENDING,
      history: [],
    });

    leaves = new LeaveService(
      leaveRepo,
      ds.getRepository(LeaveBalanceEntity),
      people,
    );
    const shifts = new ShiftService(
      ds.getRepository(ShiftTemplateEntity),
      ds.getRepository(ShiftAssignmentEntity),
      ds.getRepository(AttendanceRecordEntity),
      people,
      leaveRepo,
    );
    desk = new HrDeskService(
      people,
      ds.getRepository(DepartmentEntity),
      leaveRepo,
      shifts,
    );
  });

  afterEach(async () => {
    await ds.destroy();
  });

  it('تصویرِ امروز: حاضر، مرخصی، بی‌ثبت و پرسنلِ فعال', async () => {
    const data = await desk.desk(orgId, DAY);
    expect(data.date).toBe(DAY);
    // سه نفرِ فعال (نفرِ قطعِ همکاری شمرده نمی‌شود).
    expect(data.headcount).toBe(3);
    expect(data.terminated).toBe(1);
    expect(data.attendance.present).toBe(1);
    expect(data.attendance.onLeave).toBe(1);
    expect(data.attendance.unrecorded).toBe(1);
    expect(data.attendance.scheduled).toBe(2);
  });

  it('سطل‌ها با شمارشِ درست و پیوندِ قابلِ‌اقدام می‌آیند', async () => {
    const data = await desk.desk(orgId, DAY);
    const byKey = new Map(data.buckets.map((b) => [b.key, b]));
    expect(byKey.get('pendingLeaves')?.count).toBe(1);
    expect(byKey.get('unrecorded')?.count).toBe(1);
    expect(byKey.get('onLeaveToday')?.count).toBe(1);
    expect(byKey.get('contractsExpiring')?.count).toBe(1);
    expect(byKey.get('unrecorded')?.href).toContain('/workforce');
  });

  it('مرخصیِ معلق با نامِ پرسنل و بخش می‌آید', async () => {
    const data = await desk.desk(orgId, DAY);
    expect(data.pendingLeaves).toHaveLength(1);
    const row = data.pendingLeaves[0];
    expect(row.personnelName).toBe('سعید نوری');
    expect(row.departmentName).toBe('فنی');
    expect(row.typeLabel).toBe('استعلاجی');
  });

  it('قراردادِ رو به پایان با روزهای باقی‌مانده', async () => {
    const data = await desk.desk(orgId, DAY);
    expect(data.expiringContracts).toHaveLength(1);
    const row = data.expiringContracts[0];
    expect(row.id).toBe(farNameId);
    expect(row.daysLeft).toBe(10);
  });

  it('تفکیکِ واحدها بی‌ثبت و مرخصیِ امروز را نشان می‌دهد', async () => {
    const data = await desk.desk(orgId, DAY);
    const tech = data.departments.find((d) => d.id === techId);
    const hk = data.departments.find((d) => d.id === housekeepingId);
    expect(tech?.headcount).toBe(2);
    expect(tech?.unrecorded).toBe(1);
    expect(hk?.onLeave).toBe(1);
  });

  it('شمارشِ مرخصیِ معلق برای نشانِ منو', async () => {
    await expect(desk.pendingCount(orgId)).resolves.toEqual({ count: 1 });
  });

  it('ماندهٔ مرخصیِ همه در یک کوئری', async () => {
    await ds.getRepository(LeaveBalanceEntity).save({
      organizationId: orgId,
      personnelId: farNameId,
      year: 2026,
      type: LeaveType.ANNUAL,
      entitledDays: 20,
    });
    const result = await leaves.balancesBulk(orgId, 2026);
    expect(result.balances[farNameId]).toMatchObject({
      entitled: 20,
      used: 0,
      remaining: 20,
    });
    // مصرف از مرخصیِ تأییدشده شمرده می‌شود، نه از عددِ جدا.
    const withLeave = Object.values(result.balances).find(
      (b) => b.used === 3,
    );
    expect(withLeave).toBeTruthy();
  });
});
