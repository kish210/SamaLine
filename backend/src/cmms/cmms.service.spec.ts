jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import type { DataSource } from 'typeorm';
import { createTestDataSource } from '../testing/test-database';
import { AssetEntity, AssetStatus } from '../database/entities/asset.entity';
import {
  MaintenanceRequestEntity,
  MaintenanceRequestStatus,
} from '../database/entities/maintenance-request.entity';
import {
  WorkOrderEntity,
  WorkOrderStatus,
  WorkOrderTechnicianEntity,
} from '../database/entities/work-order.entity';
import { CmmsService } from './cmms.service';

const ORG = 'org-1';
const OTHER_ORG = 'org-2';

describe('CmmsService', () => {
  let ds: DataSource;
  let service: CmmsService;

  beforeEach(async () => {
    ds = await createTestDataSource();
    service = new CmmsService(
      ds.getRepository(AssetEntity),
      ds.getRepository(MaintenanceRequestEntity),
      ds.getRepository(WorkOrderEntity),
      ds.getRepository(WorkOrderTechnicianEntity),
      ds,
    );
  });

  afterEach(async () => {
    await ds.destroy();
  });

  it('کدِ دارایی در هر سازمان یکتاست', async () => {
    await service.createAsset(ORG, { code: 'A-1', name: 'چیلر' });
    await expect(
      service.createAsset(ORG, { code: 'A-1', name: 'تکراری' }),
    ).rejects.toThrow('تکراری');
    // همان کد در سازمانِ دیگر مجاز است.
    await expect(
      service.createAsset(OTHER_ORG, { code: 'A-1', name: 'چیلرِ دیگر' }),
    ).resolves.toBeTruthy();
  });

  it('دارایی سازمانِ دیگر دیده نمی‌شود', async () => {
    const mine = await service.createAsset(ORG, { code: 'A-2', name: 'پمپ' });
    await expect(service.getAsset(OTHER_ORG, mine.id)).rejects.toThrow(
      'یافت نشد',
    );
  });

  it('جریانِ کامل: درخواست → تأیید → دستورِ کار → تکمیل → تأیید → بسته', async () => {
    const asset = await service.createAsset(ORG, {
      code: 'A-3',
      name: 'هواساز',
    });
    const req = await service.createRequest(ORG, {
      title: 'صدای غیرعادی',
      assetId: asset.id,
    });
    expect(req.number).toMatch(/^MR-/);
    expect(req.status).toBe(MaintenanceRequestStatus.NEW);

    await service.changeRequestStatus(
      ORG,
      req.id,
      MaintenanceRequestStatus.APPROVED,
    );

    const wo = await service.createWorkOrder(ORG, {
      title: 'تعویضِ یاتاقان',
      requestId: req.id,
      assetId: asset.id,
      technicianIds: ['p1', 'p2'],
    });
    expect(wo.number).toMatch(/^WO-/);
    // با تکنسین، دستورِ کار مستقیم «ارجاع‌شده» است.
    expect(wo.status).toBe(WorkOrderStatus.ASSIGNED);

    // ساختِ دستورِ کار، درخواست را هم جلو می‌برد.
    const afterAssign = await service.getRequest(ORG, req.id);
    expect(afterAssign.status).toBe(MaintenanceRequestStatus.ASSIGNED);

    const full = await service.getWorkOrder(ORG, wo.id);
    expect(full.technicians).toHaveLength(2);
    expect(full.technicians[0].isPrimary).toBe(true);

    await service.changeWorkOrderStatus(
      ORG,
      wo.id,
      WorkOrderStatus.IN_PROGRESS,
    );
    const completed = await service.changeWorkOrderStatus(
      ORG,
      wo.id,
      WorkOrderStatus.COMPLETED,
    );
    expect(completed.completedAt).toBeTruthy();

    // تکمیل خودش «تأییدشده» نیست؛ مدیر باید تأیید کند.
    const verified = await service.changeWorkOrderStatus(
      ORG,
      wo.id,
      WorkOrderStatus.VERIFIED,
      { actorId: 'manager-1' },
    );
    expect(verified.verifiedByUserId).toBe('manager-1');

    await service.changeWorkOrderStatus(ORG, wo.id, WorkOrderStatus.CLOSED);
    const closed = await service.getWorkOrder(ORG, wo.id);
    expect(closed.status).toBe(WorkOrderStatus.CLOSED);
    // تاریخچه‌ی گذارها ثبت شده است.
    expect(closed.history.length).toBeGreaterThanOrEqual(4);
  });

  it('گذارِ نامجاز رد می‌شود', async () => {
    const req = await service.createRequest(ORG, { title: 'نشتی' });
    // «جدید» مستقیم «تکمیل‌شده» نمی‌شود.
    await expect(
      service.changeRequestStatus(
        ORG,
        req.id,
        MaintenanceRequestStatus.COMPLETED,
      ),
    ).rejects.toThrow('مجاز نیست');
  });

  it('رد کردنِ درخواست دلیل را نگه می‌دارد', async () => {
    const req = await service.createRequest(ORG, { title: 'درخواستِ بی‌مورد' });
    const rejected = await service.changeRequestStatus(
      ORG,
      req.id,
      MaintenanceRequestStatus.REJECTED,
      { note: 'خارج از دامنه' },
    );
    expect(rejected.rejectionReason).toBe('خارج از دامنه');
  });

  it('فیلتر و صفحه‌بندیِ درخواست‌ها کار می‌کند', async () => {
    await service.createRequest(ORG, { title: 'برق اتاق ۱۰۱' });
    await service.createRequest(ORG, { title: 'لوله‌کشی لابی' });
    await service.createRequest(OTHER_ORG, { title: 'مالِ سازمانِ دیگر' });

    const all = await service.listRequests(ORG, {});
    expect(all.total).toBe(2);

    const searched = await service.listRequests(ORG, { search: 'لابی' });
    expect(searched.total).toBe(1);
    expect(searched.rows[0].title).toContain('لابی');

    const paged = await service.listRequests(ORG, { page: 1, pageSize: 1 });
    expect(paged.rows).toHaveLength(1);
    expect(paged.total).toBe(2);
  });

  it('دارایی نمی‌تواند والدِ خودش شود', async () => {
    const a = await service.createAsset(ORG, { code: 'A-9', name: 'والد' });
    await expect(
      service.updateAsset(ORG, a.id, { parentId: a.id }),
    ).rejects.toThrow('والدِ خودش');
  });

  it('وضعیتِ دارایی قابلِ تغییر است', async () => {
    const a = await service.createAsset(ORG, { code: 'A-10', name: 'آسانسور' });
    const out = await service.setAssetStatus(
      ORG,
      a.id,
      AssetStatus.OUT_OF_SERVICE,
    );
    expect(out.status).toBe(AssetStatus.OUT_OF_SERVICE);
  });
});
