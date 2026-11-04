jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import type { DataSource } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { createTestDataSource } from '../testing/test-database';
import { OrganizationEntity } from '../database/entities/organization.entity';
import { DepartmentEntity } from '../database/entities/department.entity';
import {
  ContractType,
  EmploymentStatus,
  PersonnelEntity,
} from '../database/entities/personnel.entity';
import {
  LeaveRequestEntity,
  LeaveStatus,
  LeaveType,
} from '../database/entities/leave-request.entity';
import {
  AttendanceRecordEntity,
  AttendanceSource,
  AttendanceStatus,
} from '../database/entities/work-shift.entity';
import { HrExportService } from './hr-export.service';

/**
 * خروجیِ اکسلِ HR.
 *
 * فایل دوباره با ExcelJS خوانده می‌شود تا فقط «بافر ساخته شد» سنجیده نشود:
 * برچسبِ فارسی، تاریخِ شمسی، نامِ بخش/پرسنل و جداییِ سازمان‌ها هم بررسی می‌شوند.
 */
describe('HrExportService', () => {
  let ds: DataSource;
  let exporter: HrExportService;
  let orgId: string;
  let otherOrgId: string;
  let departmentId: string;
  let personId: string;
  let otherPersonId: string;

  const readSheet = async (buffer: Buffer) => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    return workbook.worksheets[0];
  };

  const headers = (sheet: ExcelJS.Worksheet) =>
    (sheet.getRow(1).values as unknown[]).slice(1).map(String);
  const cells = (sheet: ExcelJS.Worksheet, row: number) =>
    (sheet.getRow(row).values as unknown[]).slice(1).map(String);

  beforeEach(async () => {
    ds = await createTestDataSource();
    const org = await ds.getRepository(OrganizationEntity).save({ name: 'هتل' });
    orgId = org.id;
    const other = await ds
      .getRepository(OrganizationEntity)
      .save({ name: 'هتلِ دیگر' });
    otherOrgId = other.id;

    const dep = await ds
      .getRepository(DepartmentEntity)
      .save({ organizationId: orgId, name: 'خانه‌داری', key: 'housekeeping' });
    departmentId = dep.id;

    const person = await ds.getRepository(PersonnelEntity).save({
      organizationId: orgId,
      fullName: 'مریم کریمی',
      mobile: '09120000001',
      employeeNo: 'EMP-7',
      position: 'سرپرستِ طبقه',
      departmentId,
      hireDate: '2025-03-21',
      employmentStatus: EmploymentStatus.ACTIVE,
      contractType: ContractType.FULL_TIME,
      contractEndsAt: '2026-03-20',
    });
    personId = person.id;
    const otherPerson = await ds.getRepository(PersonnelEntity).save({
      organizationId: otherOrgId,
      fullName: 'فردِ دیگر',
      mobile: '09120000099',
    });
    otherPersonId = otherPerson.id;

    const leaves = ds.getRepository(LeaveRequestEntity);
    await leaves.save({
      organizationId: orgId,
      number: 'LV-00001',
      personnelId: personId,
      departmentId,
      type: LeaveType.ANNUAL,
      fromDate: '2026-02-01',
      toDate: '2026-02-03',
      days: 3,
      reason: 'سفر',
      status: LeaveStatus.APPROVED,
      decidedAt: new Date('2026-01-30T10:00:00Z'),
      decisionNote: 'تأییدِ مدیر',
      history: [],
    });
    await leaves.save({
      organizationId: otherOrgId,
      number: 'LV-99999',
      personnelId: otherPersonId,
      type: LeaveType.SICK,
      fromDate: '2026-02-02',
      toDate: '2026-02-02',
      days: 1,
      status: LeaveStatus.PENDING,
      history: [],
    });

    const attendance = ds.getRepository(AttendanceRecordEntity);
    await attendance.save({
      organizationId: orgId,
      personnelId: personId,
      date: '2026-02-01',
      status: AttendanceStatus.LATE,
      checkIn: '07:20',
      checkOut: '15:05',
      minutesWorked: 465,
      source: AttendanceSource.BOT,
      note: '',
    });

    exporter = new HrExportService(
      ds.getRepository(PersonnelEntity),
      ds.getRepository(DepartmentEntity),
      leaves,
      attendance,
    );
  });

  afterEach(async () => {
    await ds.destroy();
  });

  it('پروندهٔ پرسنل را با برچسبِ فارسی و تاریخِ شمسی می‌نویسد', async () => {
    const buffer = await exporter.personnelXlsx(orgId);
    expect(buffer.subarray(0, 2).toString()).toBe('PK');

    const sheet = await readSheet(buffer);
    expect(sheet.name).toBe('پرسنل');
    expect(sheet.views[0]?.rightToLeft).toBe(true);
    expect(headers(sheet)).toContain('کد پرسنلی');

    const row = cells(sheet, 2);
    expect(row[0]).toBe('EMP-7');
    expect(row[1]).toBe('مریم کریمی');
    expect(row[4]).toBe('خانه‌داری');
    // تاریخِ میلادیِ 2025-03-21 در تقویمِ شمسی ۱ فروردین ۱۴۰۴ است.
    expect(row[5]).toContain('۱۴۰۴');
    expect(row[6]).toBe('شاغل');
    expect(row[7]).toBe('تمام‌وقت');
  });

  it('فقط پرسنلِ همان سازمان را می‌نویسد', async () => {
    const sheet = await readSheet(await exporter.personnelXlsx(orgId));
    const names = [2, 3, 4]
      .map((i) => (sheet.getRow(i).values as unknown[])[2])
      .filter(Boolean)
      .map(String);
    expect(names).toContain('مریم کریمی');
    expect(names).not.toContain('فردِ دیگر');
  });

  it('مرخصی‌ها را با نامِ پرسنل، نوع و وضعیت می‌نویسد', async () => {
    const sheet = await readSheet(await exporter.leavesXlsx(orgId));
    expect(sheet.name).toBe('مرخصی');
    const row = cells(sheet, 2);
    expect(row[0]).toBe('LV-00001');
    expect(row[1]).toBe('مریم کریمی');
    expect(row[3]).toBe('استحقاقی');
    expect(row[6]).toBe('3');
    expect(row[7]).toBe('تأییدشده');
    expect(row[9]).toContain('۱۴۰۴');
  });

  it('فیلترِ وضعیت روی خروجیِ مرخصی اثر می‌گذارد', async () => {
    const sheet = await readSheet(
      await exporter.leavesXlsx(orgId, { status: LeaveStatus.REJECTED }),
    );
    // فقط سرستون می‌ماند: هیچ مرخصیِ ردشده‌ای ثبت نشده است.
    expect(sheet.rowCount).toBe(1);
  });

  it('حضوروغیاب را در بازه می‌نویسد و بیرونِ بازه را نه', async () => {
    const inside = await readSheet(
      await exporter.attendanceXlsx(orgId, {
        from: '2026-02-01',
        to: '2026-02-02',
      }),
    );
    expect(inside.name).toBe('حضوروغیاب');
    const row = cells(inside, 2);
    expect(row[1]).toBe('مریم کریمی');
    expect(row[2]).toBe('تأخیر');
    expect(row[3]).toBe('07:20');
    expect(row[5]).toBe('465');
    expect(row[6]).toBe('ربات');

    const outside = await readSheet(
      await exporter.attendanceXlsx(orgId, {
        from: '2026-03-01',
        to: '2026-03-02',
      }),
    );
    expect(outside.rowCount).toBe(1);
  });
});
