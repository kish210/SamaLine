jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import type { DataSource } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { createTestDataSource } from '../testing/test-database';
import { AssetEntity } from '../database/entities/asset.entity';
import { MaintenanceRequestEntity } from '../database/entities/maintenance-request.entity';
import {
  WorkOrderEntity,
  WorkOrderTechnicianEntity,
} from '../database/entities/work-order.entity';
import { PersonnelEntity } from '../database/entities/personnel.entity';
import { HotelRoomEntity } from '../database/entities/hotel-room.entity';
import { DepartmentEntity } from '../database/entities/department.entity';
import { CmmsService } from './cmms.service';
import { OperationalExportService } from './operational-export.service';

const ORG = 'org-1';
const OTHER_ORG = 'org-2';

/**
 * خروجیِ اکسلِ CMMS.
 *
 * فایل با ExcelJS دوباره خوانده می‌شود تا فقط «بافر تولید شد» سنجیده نشود؛
 * برچسبِ فارسی، نامِ اتاق و جدا بودنِ سازمان‌ها هم بررسی می‌شوند، چون همین‌ها
 * چیزی است که مدیر در فایل می‌بیند.
 */
describe('OperationalExportService', () => {
  let ds: DataSource;
  let cmms: CmmsService;
  let exporter: OperationalExportService;

  /** اتاق و بخشِ پایه برای اینکه برچسب‌ها در اکسل نام بدهند نه UUID. */
  const seedBase = async (organizationId = ORG) => {
    const department = await ds.getRepository(DepartmentEntity).save({
      organizationId,
      name: 'فنی',
      key: 'technical',
    });
    const room = await ds.getRepository(HotelRoomEntity).save({
      organizationId,
      number: '101',
      floor: 1,
      kind: 'سوئیت',
    });
    const person = await ds.getRepository(PersonnelEntity).save({
      organizationId,
      fullName: 'مریم کریمی',
      mobile: '09120000001',
    });
    return { department, room, person };
  };

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
    exporter = new OperationalExportService(
      cmms,
      ds.getRepository(DepartmentEntity),
      ds.getRepository(HotelRoomEntity),
      ds.getRepository(PersonnelEntity),
    );
  });

  afterEach(async () => {
    await ds.destroy();
  });

  /** خواندنِ فایلِ ساخته‌شده؛ اگر zip معتبر نباشد همین‌جا می‌شکند. */
  const readSheet = async (buffer: Buffer, sheetIndex = 1) => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    const sheet = workbook.worksheets[sheetIndex - 1];
    return sheet;
  };

  it('فایلِ xlsx معتبر با شیتِ راست‌به‌چپ می‌سازد', async () => {
    const { room, department, person } = await seedBase();
    await cmms.createRequest(ORG, {
      title: 'نشتیِ شیر آب',
      description: 'حمامِ اتاق',
      roomId: room.id,
      departmentId: department.id,
      requestedByPersonnelId: person.id,
      location: 'طبقهٔ ۱',
    });

    const buffer = await exporter.requestsXlsx(ORG, {});
    // فایلِ xlsx یک آرشیوِ zip است و با PK شروع می‌شود.
    expect(buffer.subarray(0, 2).toString()).toBe('PK');

    const sheet = await readSheet(buffer);
    expect(sheet.name).toBe('درخواست‌ها');
    expect(sheet.views[0]?.rightToLeft).toBe(true);

    const headers = (sheet.getRow(1).values as unknown[]).slice(1);
    expect(headers).toContain('شماره');
    expect(headers).toContain('وضعیت');
    expect(headers).toContain('اتاق');

    const row = sheet.getRow(2);
    const cells = (row.values as unknown[]).slice(1).map(String);
    // عنوان، وضعیتِ فارسی، اتاق به‌صورت «شماره (نوع)» و بخش با نام.
    expect(cells).toContain('نشتیِ شیر آب');
    expect(cells).toContain('جدید');
    expect(cells).toContain('101 (سوئیت)');
    expect(cells).toContain('فنی');
  });

  it('فقط دادهٔ همان سازمان را می‌نویسد', async () => {
    await seedBase(ORG);
    await seedBase(OTHER_ORG);
    await cmms.createRequest(ORG, { title: 'مالِ ما' });
    await cmms.createRequest(OTHER_ORG, { title: 'مالِ دیگری' });

    const sheet = await readSheet(await exporter.requestsXlsx(ORG, {}));
    const titles = [];
    for (let i = 2; i <= sheet.rowCount; i += 1) {
      // ستونِ دوم «عنوان» است؛ ستونِ اول شماره‌ی درخواست.
      const cells = (sheet.getRow(i).values as unknown[]).slice(1);
      titles.push(String(cells[1] ?? ''));
    }
    expect(titles).toContain('مالِ ما');
    expect(titles).not.toContain('مالِ دیگری');
  });

  it('دستورهای کار را با برچسبِ وضعیت می‌نویسد', async () => {
    await cmms.createWorkOrder(ORG, { title: 'سرویسِ هواساز' });

    const buffer = await exporter.workOrdersXlsx(ORG, {});
    const sheet = await readSheet(buffer);
    expect(sheet.name).toBe('دستورهای کار');
    const cells = (sheet.getRow(2).values as unknown[]).slice(1).map(String);
    expect(cells).toContain('سرویسِ هواساز');
    // وضعیتِ پیش‌فرضِ دستورِ کارِ تازه «draft» است که در پنل «بی‌متصدی» است.
    expect(cells).toContain('بی‌متصدی');
  });
});
