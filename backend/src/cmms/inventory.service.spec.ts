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
import { PersonnelEntity } from '../database/entities/personnel.entity';
import { HotelRoomEntity } from '../database/entities/hotel-room.entity';
import {
  SparePartEntity,
  StockMovementEntity,
  StockMovementType,
} from '../database/entities/spare-part.entity';
import { CmmsService } from './cmms.service';
import { InventoryService } from './inventory.service';

const ORG = 'org-1';
const OTHER_ORG = 'org-2';

describe('InventoryService', () => {
  let ds: DataSource;
  let inv: InventoryService;
  let cmms: CmmsService;

  /** قطعه‌ای با موجودیِ اولیه و نقطهٔ سفارشِ دلخواه. */
  const seedPart = (over: Record<string, unknown> = {}) =>
    inv.createPart(ORG, {
      code: 'P-1',
      name: 'فیلترِ هوا',
      unit: 'عدد',
      unitCost: 1000,
      openingQuantity: 10,
      ...over,
    });

  /** دستورِ کارِ بازِ منتسب، تا مصرفِ قطعه رویش ممکن باشد. */
  const seedOrder = () =>
    cmms.createWorkOrder(ORG, { title: 'سرویسِ هواساز', technicianIds: ['t1'] });

  beforeEach(async () => {
    ds = await createTestDataSource();
    inv = new InventoryService(
      ds.getRepository(SparePartEntity),
      ds.getRepository(StockMovementEntity),
      ds.getRepository(WorkOrderEntity),
      ds,
    );
    cmms = new CmmsService(
      ds.getRepository(AssetEntity),
      ds.getRepository(MaintenanceRequestEntity),
      ds.getRepository(WorkOrderEntity),
      ds.getRepository(WorkOrderTechnicianEntity),
      ds.getRepository(PersonnelEntity),
      ds.getRepository(HotelRoomEntity),
      ds,
    );
  });

  afterEach(async () => {
    await ds.destroy();
  });

  describe('قطعه', () => {
    it('کدِ انبار در هر سازمان یکتاست', async () => {
      await seedPart();
      await expect(seedPart({ name: 'تکراری' })).rejects.toThrow('تکراری');
      // همان کد در سازمانِ دیگر مجاز است.
      await expect(
        inv.createPart(OTHER_ORG, { code: 'P-1', name: 'مالِ دیگری' }),
      ).resolves.toBeTruthy();
    });

    it('کد و نام لازم‌اند', async () => {
      await expect(
        inv.createPart(ORG, { code: '  ', name: 'بی‌کد' }),
      ).rejects.toThrow('کدِ انبار لازم');
      await expect(
        inv.createPart(ORG, { code: 'P-9', name: '  ' }),
      ).rejects.toThrow('نامِ قطعه لازم');
    });

    it('قطعهٔ سازمانِ دیگر دیده نمی‌شود', async () => {
      const mine = await seedPart();
      await expect(inv.getPart(OTHER_ORG, mine.id)).rejects.toThrow(
        'یافت نشد',
      );
    });

    it('موجودیِ اولیه یک سطرِ «ورود» در دفتر می‌سازد', async () => {
      const part = await seedPart({ openingQuantity: 7 });
      expect(part.quantityOnHand).toBe(7);

      const ledger = await inv.listMovements(ORG, { partId: part.id });
      expect(ledger.total).toBe(1);
      expect(ledger.rows[0].type).toBe(StockMovementType.RECEIPT);
      expect(ledger.rows[0].quantity).toBe(7);
      expect(ledger.rows[0].balanceAfter).toBe(7);
      expect(ledger.rows[0].reference).toBe('موجودیِ اولیه');
    });

    it('موجودیِ اولیهٔ صفر سطرِ بی‌خود نمی‌سازد', async () => {
      const part = await seedPart({ openingQuantity: 0 });
      expect(part.quantityOnHand).toBe(0);
      expect((await inv.listMovements(ORG, { partId: part.id })).total).toBe(0);
    });

    it('ویرایش، موجودی را دست‌کاری نمی‌کند', async () => {
      const part = await seedPart({ openingQuantity: 10 });
      const saved = await inv.updatePart(ORG, part.id, {
        name: 'فیلترِ هوا (نو)',
        reorderLevel: 4,
        // تلاش برای نوشتنِ مستقیمِ موجودی باید بی‌اثر بماند.
        quantityOnHand: 999,
      } as never);

      expect(saved.name).toBe('فیلترِ هوا (نو)');
      expect(saved.reorderLevel).toBe(4);
      // قاعده‌ی محوری: موجودی فقط با گردشِ انبار عوض می‌شود.
      expect(saved.quantityOnHand).toBe(10);
    });

    it('ویرایشِ کد هم یکتایی را نگه می‌دارد', async () => {
      await seedPart();
      const second = await inv.createPart(ORG, { code: 'P-2', name: 'واشر' });
      await expect(
        inv.updatePart(ORG, second.id, { code: 'P-1' }),
      ).rejects.toThrow('تکراری');
      // همان کدِ خودش مشکلی نیست.
      await expect(
        inv.updatePart(ORG, second.id, { code: 'P-2', name: 'واشرِ نو' }),
      ).resolves.toBeTruthy();
    });

    it('قطعهٔ غیرفعال از فهرستِ پیش‌فرض بیرون می‌رود', async () => {
      const part = await seedPart();
      await inv.updatePart(ORG, part.id, { isActive: false });

      expect((await inv.listParts(ORG, {})).total).toBe(0);
      // ولی دفتر و خودِ رکورد می‌مانند.
      expect((await inv.listParts(ORG, { includeInactive: true })).total).toBe(1);
      expect((await inv.listMovements(ORG, { partId: part.id })).total).toBe(1);
    });

    it('جست‌وجو روی نام، کد و تأمین‌کننده کار می‌کند', async () => {
      await seedPart({ code: 'FLT-1', name: 'فیلترِ هوا', supplier: 'پارس‌فن' });
      await inv.createPart(ORG, { code: 'BLT-9', name: 'تسمه' });

      expect((await inv.listParts(ORG, { search: 'فیلتر' })).total).toBe(1);
      expect((await inv.listParts(ORG, { search: 'BLT' })).total).toBe(1);
      expect((await inv.listParts(ORG, { search: 'پارس' })).total).toBe(1);
      expect((await inv.listParts(ORG, {})).total).toBe(2);
    });
  });

  describe('گردشِ انبار', () => {
    it('ورود موجودی را بالا می‌برد و موجودیِ هر سطر ثبت می‌شود', async () => {
      const part = await seedPart({ openingQuantity: 5 });
      await inv.move(ORG, {
        partId: part.id,
        type: StockMovementType.RECEIPT,
        quantity: 3,
        reference: 'فاکتور ۱۲۰',
      });

      expect((await inv.getPart(ORG, part.id)).quantityOnHand).toBe(8);
      const ledger = await inv.listMovements(ORG, { partId: part.id });
      // دفتر از نو به کهنه مرتب است.
      expect(ledger.rows[0].balanceAfter).toBe(8);
      expect(ledger.rows[1].balanceAfter).toBe(5);
    });

    it('مصرف بیشتر از موجودی رد می‌شود', async () => {
      const part = await seedPart({ openingQuantity: 2 });
      await expect(
        inv.move(ORG, {
          partId: part.id,
          type: StockMovementType.ISSUE,
          quantity: 3,
        }),
      ).rejects.toThrow('بیشتر از آن خارج نمی‌شود');
      // موجودی و دفتر دست‌نخورده می‌مانند.
      expect((await inv.getPart(ORG, part.id)).quantityOnHand).toBe(2);
      expect((await inv.listMovements(ORG, { partId: part.id })).total).toBe(1);
    });

    it('مصرفِ درست تا صفر مجاز است', async () => {
      const part = await seedPart({ openingQuantity: 2 });
      await inv.move(ORG, {
        partId: part.id,
        type: StockMovementType.ISSUE,
        quantity: 2,
      });
      expect((await inv.getPart(ORG, part.id)).quantityOnHand).toBe(0);
    });

    it('ضایعات هم موجودی را کم می‌کند', async () => {
      const part = await seedPart({ openingQuantity: 4 });
      await inv.move(ORG, {
        partId: part.id,
        type: StockMovementType.SCRAP,
        quantity: 1,
        note: 'شکسته رسید',
      });
      expect((await inv.getPart(ORG, part.id)).quantityOnHand).toBe(3);
    });

    it('تعدادِ صفر یا کسری رد می‌شود', async () => {
      const part = await seedPart();
      for (const quantity of [0, -2, 1.5]) {
        await expect(
          inv.move(ORG, {
            partId: part.id,
            type: StockMovementType.RECEIPT,
            quantity,
          }),
        ).rejects.toThrow('عددِ صحیحِ مثبت');
      }
    });

    it('قطعهٔ سازمانِ دیگر گردش نمی‌گیرد', async () => {
      const part = await seedPart();
      await expect(
        inv.move(OTHER_ORG, {
          partId: part.id,
          type: StockMovementType.RECEIPT,
          quantity: 1,
        }),
      ).rejects.toThrow('یافت نشد');
    });

    it('ورودِ گران‌تر، قیمتِ واحد را به میانگینِ موزون می‌برد', async () => {
      // ۱۰ عدد × ۱۰۰۰ در انبار؛ ۱۰ عددِ تازه × ۲۰۰۰ ⇒ میانگین ۱۵۰۰.
      const part = await seedPart({ openingQuantity: 10, unitCost: 1000 });
      await inv.move(ORG, {
        partId: part.id,
        type: StockMovementType.RECEIPT,
        quantity: 10,
        unitCost: 2000,
      });
      expect((await inv.getPart(ORG, part.id)).unitCost).toBe(1500);
    });

    it('مصرف قیمتِ واحد را عوض نمی‌کند', async () => {
      const part = await seedPart({ openingQuantity: 10, unitCost: 1000 });
      await inv.move(ORG, {
        partId: part.id,
        type: StockMovementType.ISSUE,
        quantity: 4,
      });
      expect((await inv.getPart(ORG, part.id)).unitCost).toBe(1000);
    });

    it('دفتر با نامِ قطعه برمی‌گردد، نه شناسهٔ خام', async () => {
      const part = await seedPart({ code: 'FLT-1', name: 'فیلترِ هوا' });
      const ledger = await inv.listMovements(ORG, {});
      expect(ledger.rows[0].partCode).toBe('FLT-1');
      expect(ledger.rows[0].partName).toBe('فیلترِ هوا');
      expect(ledger.rows[0].partUnit).toBe('عدد');
      expect(ledger.rows[0].partId).toBe(part.id);
    });

    it('دفترِ سازمانِ دیگر دیده نمی‌شود', async () => {
      await seedPart();
      await inv.createPart(OTHER_ORG, {
        code: 'X-1',
        name: 'غریبه',
        openingQuantity: 5,
      });
      expect((await inv.listMovements(ORG, {})).total).toBe(1);
      expect((await inv.listMovements(OTHER_ORG, {})).total).toBe(1);
    });
  });

  describe('مصرف روی دستورِ کار', () => {
    it('قطعه و هزینه روی دستورِ کار می‌نشیند', async () => {
      const part = await seedPart({ openingQuantity: 10, unitCost: 1500 });
      const order = await seedOrder();

      await inv.move(ORG, {
        partId: part.id,
        type: StockMovementType.ISSUE,
        quantity: 2,
        workOrderId: order.id,
      });

      const full = await cmms.getWorkOrder(ORG, order.id);
      expect(full.parts).toHaveLength(1);
      expect(full.parts[0].partId).toBe(part.id);
      expect(full.parts[0].quantity).toBe(2);
      // هزینهٔ داخلی خودکار بالا می‌رود تا گزارشِ هزینه دستی نشود.
      expect(full.internalCost).toBe(3000);
    });

    it('مصرفِ دوباره‌ی همان قطعه سطرِ تکراری نمی‌سازد', async () => {
      const part = await seedPart({ openingQuantity: 10, unitCost: 1000 });
      const order = await seedOrder();
      const issue = (quantity: number) =>
        inv.move(ORG, {
          partId: part.id,
          type: StockMovementType.ISSUE,
          quantity,
          workOrderId: order.id,
        });

      await issue(2);
      await issue(3);

      const full = await cmms.getWorkOrder(ORG, order.id);
      expect(full.parts).toHaveLength(1);
      expect(full.parts[0].quantity).toBe(5);
      expect(full.internalCost).toBe(5000);
    });

    it('برگشتِ قطعه هم انبار و هم هزینه را اصلاح می‌کند', async () => {
      const part = await seedPart({ openingQuantity: 10, unitCost: 1000 });
      const order = await seedOrder();
      await inv.move(ORG, {
        partId: part.id,
        type: StockMovementType.ISSUE,
        quantity: 3,
        workOrderId: order.id,
      });
      await inv.move(ORG, {
        partId: part.id,
        type: StockMovementType.RETURN,
        quantity: 1,
        workOrderId: order.id,
      });

      expect((await inv.getPart(ORG, part.id)).quantityOnHand).toBe(8);
      const full = await cmms.getWorkOrder(ORG, order.id);
      expect(full.parts[0].quantity).toBe(2);
      // هزینه هم پایین می‌آید؛ وگرنه هزینهٔ کار متورم می‌ماند.
      expect(full.internalCost).toBe(2000);
    });

    it('برگشتِ کلِ قطعه سطر را از دستورِ کار برمی‌دارد', async () => {
      const part = await seedPart({ openingQuantity: 10, unitCost: 1000 });
      const order = await seedOrder();
      await inv.move(ORG, {
        partId: part.id,
        type: StockMovementType.ISSUE,
        quantity: 2,
        workOrderId: order.id,
      });
      await inv.move(ORG, {
        partId: part.id,
        type: StockMovementType.RETURN,
        quantity: 2,
        workOrderId: order.id,
      });

      const full = await cmms.getWorkOrder(ORG, order.id);
      expect(full.parts).toHaveLength(0);
      expect(full.internalCost).toBe(0);
    });

    it('دستورِ کارِ بسته قطعهٔ تازه نمی‌گیرد', async () => {
      const part = await seedPart({ openingQuantity: 10 });
      const order = await seedOrder();
      await cmms.changeWorkOrderStatus(
        ORG,
        order.id,
        WorkOrderStatus.CANCELLED,
      );

      await expect(
        inv.move(ORG, {
          partId: part.id,
          type: StockMovementType.ISSUE,
          quantity: 1,
          workOrderId: order.id,
        }),
      ).rejects.toThrow('بسته‌شده');
      // انبار هم دست‌نخورده می‌ماند.
      expect((await inv.getPart(ORG, part.id)).quantityOnHand).toBe(10);
    });

    it('دستورِ کارِ سازمانِ دیگر پذیرفته نمی‌شود', async () => {
      const part = await seedPart({ openingQuantity: 10 });
      const foreign = await cmms.createWorkOrder(OTHER_ORG, {
        title: 'مالِ غریبه',
      });
      await expect(
        inv.move(ORG, {
          partId: part.id,
          type: StockMovementType.ISSUE,
          quantity: 1,
          workOrderId: foreign.id,
        }),
      ).rejects.toThrow('یافت نشد');
    });

    it('گردشِ یک دستورِ کار قابلِ فهرست کردن است', async () => {
      const part = await seedPart({ openingQuantity: 10 });
      const order = await seedOrder();
      await inv.move(ORG, {
        partId: part.id,
        type: StockMovementType.ISSUE,
        quantity: 1,
        workOrderId: order.id,
      });

      const rows = await inv.listMovements(ORG, { workOrderId: order.id });
      expect(rows.total).toBe(1);
      expect(rows.rows[0].workOrderId).toBe(order.id);
    });
  });

  describe('انبارگردانی', () => {
    it('کمبودِ شمارش، گردشِ اصلاحیِ رو به پایین می‌سازد', async () => {
      const part = await seedPart({ openingQuantity: 10 });
      const { movement, part: after } = await inv.recount(
        ORG,
        part.id,
        7,
        'دو عدد کم بود',
      );

      expect(movement?.type).toBe(StockMovementType.ADJUST_OUT);
      expect(movement?.quantity).toBe(3);
      expect(after.quantityOnHand).toBe(7);
      expect(movement?.reference).toBe('انبارگردانی');
    });

    it('شمارشِ بیشتر، گردشِ رو به بالا می‌سازد', async () => {
      const part = await seedPart({ openingQuantity: 10 });
      const { movement, part: after } = await inv.recount(ORG, part.id, 12);
      expect(movement?.type).toBe(StockMovementType.ADJUST_IN);
      expect(after.quantityOnHand).toBe(12);
    });

    it('شمارشِ برابر چیزی در دفتر نمی‌نویسد', async () => {
      const part = await seedPart({ openingQuantity: 10 });
      const { movement } = await inv.recount(ORG, part.id, 10);
      expect(movement).toBeNull();
      expect((await inv.listMovements(ORG, { partId: part.id })).total).toBe(1);
    });

    it('شمارشِ منفی رد می‌شود', async () => {
      const part = await seedPart();
      await expect(inv.recount(ORG, part.id, -1)).rejects.toThrow(
        'غیرمنفی',
      );
    });
  });

  describe('خلاصهٔ انبار', () => {
    it('«زیرِ نقطهٔ سفارش» فقط قطعهٔ هشدارخواه را می‌شمارد', async () => {
      // زیرِ نقطهٔ سفارش.
      await inv.createPart(ORG, {
        code: 'A',
        name: 'کم',
        reorderLevel: 5,
        openingQuantity: 3,
      });
      // بالای نقطهٔ سفارش.
      await inv.createPart(ORG, {
        code: 'B',
        name: 'کافی',
        reorderLevel: 5,
        openingQuantity: 20,
      });
      // نقطهٔ سفارشِ صفر یعنی هشدار نمی‌خواهم، هرچند موجودی صفر است.
      await inv.createPart(ORG, { code: 'C', name: 'بی‌هشدار' });

      const sum = await inv.summary(ORG);
      const byKey = Object.fromEntries(sum.buckets.map((b) => [b.key, b]));
      expect(byKey.lowStock.count).toBe(1);
      // «موجودیِ صفر» ولی همهٔ قطعاتِ تهی را می‌شمارد.
      expect(byKey.outOfStock.count).toBe(1);

      // سطل، فهرستِ خودش را بازمی‌سازد (drill-down).
      const drill = await inv.listParts(ORG, byKey.lowStock.filter as never);
      expect(drill.total).toBe(byKey.lowStock.count);
      expect(drill.rows[0].code).toBe('A');
    });

    it('مرزِ نقطهٔ سفارش هم هشدار می‌دهد', async () => {
      await inv.createPart(ORG, {
        code: 'A',
        name: 'سرِ مرز',
        reorderLevel: 5,
        openingQuantity: 5,
      });
      expect((await inv.lowStockParts(ORG)).length).toBe(1);
    });

    it('ارزشِ انبار از موجودی × قیمتِ واحد می‌آید', async () => {
      await inv.createPart(ORG, {
        code: 'A',
        name: 'الف',
        unitCost: 1000,
        openingQuantity: 3,
      });
      await inv.createPart(ORG, {
        code: 'B',
        name: 'ب',
        unitCost: 500,
        openingQuantity: 4,
      });
      const sum = await inv.summary(ORG);
      expect(sum.valuation).toBe(3 * 1000 + 4 * 500);
    });

    it('مصرفِ ۳۰ روز فقط خروجِ مصرفی را می‌شمارد', async () => {
      const part = await seedPart({ openingQuantity: 20, unitCost: 1000 });
      await inv.move(ORG, {
        partId: part.id,
        type: StockMovementType.ISSUE,
        quantity: 2,
      });
      await inv.move(ORG, {
        partId: part.id,
        type: StockMovementType.SCRAP,
        quantity: 5,
      });

      const sum = await inv.summary(ORG);
      // ضایعات و ورود مصرف نیستند.
      expect(sum.consumption.quantity).toBe(2);
      expect(sum.consumption.cost).toBe(2000);
    });

    it('خلاصهٔ هر سازمان جداست', async () => {
      await inv.createPart(ORG, {
        code: 'A',
        name: 'مالِ ما',
        unitCost: 1000,
        openingQuantity: 2,
      });
      await inv.createPart(OTHER_ORG, {
        code: 'A',
        name: 'مالِ دیگری',
        unitCost: 9999,
        openingQuantity: 10,
      });
      expect((await inv.summary(ORG)).valuation).toBe(2000);
    });
  });
});
