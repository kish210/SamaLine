import { ValidationPipe } from '@nestjs/common';
import type { ArgumentMetadata } from '@nestjs/common';
import { RecountDto, SparePartDto, StockMovementDto } from './dto';
import { StockMovementType } from '../database/entities/spare-part.entity';

/**
 * همان لولهٔ اعتبارسنجیِ سراسریِ برنامه (`main.ts`).
 *
 * `whitelist: true` یعنی هر فیلدِ بی‌دکوراتور از بدنه حذف می‌شود؛ پس این
 * تست‌ها همان چیزی را می‌سنجند که در اجرا به سرویس می‌رسد، نه شکلِ خامِ
 * ورودیِ کلاینت.
 */
const pipe = new ValidationPipe({ whitelist: true, transform: true });
const asBody = (metatype: unknown): ArgumentMetadata => ({
  type: 'body',
  metatype: metatype as ArgumentMetadata['metatype'],
});

const run = (metatype: unknown, body: Record<string, unknown>) =>
  pipe.transform(body, asBody(metatype));

describe('DTOهای انبار', () => {
  describe('SparePartDto', () => {
    it('همان چیزی که پنل می‌فرستد سالم می‌رسد', async () => {
      const out = (await run(SparePartDto, {
        code: 'FLT-1',
        name: 'فیلترِ هوا',
        category: 'تهویه',
        unit: 'عدد',
        reorderLevel: 5,
        unitCost: 120000,
        openingQuantity: 12,
        location: 'انبارِ ۲، قفسهٔ ب',
        supplier: 'پارس‌فن',
      })) as SparePartDto;

      // موجودیِ اولیه باید از لوله رد شود، وگرنه قطعه با انبارِ صفر ساخته می‌شد.
      expect(out.openingQuantity).toBe(12);
      expect(out.reorderLevel).toBe(5);
      expect(out.unitCost).toBe(120000);
      expect(out.code).toBe('FLT-1');
    });

    it('فیلدِ بی‌دکوراتور حذف می‌شود', async () => {
      const out = (await run(SparePartDto, {
        code: 'P-1',
        name: 'قطعه',
        // تلاش برای نوشتنِ مستقیمِ موجودی؛ باید همین‌جا بیفتد.
        quantityOnHand: 999,
        organizationId: 'org-دیگر',
      })) as Record<string, unknown>;

      expect(out).not.toHaveProperty('quantityOnHand');
      expect(out).not.toHaveProperty('organizationId');
    });

    it('کد و نامِ خالی رد می‌شوند', async () => {
      await expect(run(SparePartDto, { name: 'بی‌کد' })).rejects.toBeTruthy();
      await expect(run(SparePartDto, { code: 'P-1' })).rejects.toBeTruthy();
    });

    it('عددِ منفی رد می‌شود', async () => {
      await expect(
        run(SparePartDto, { code: 'P-1', name: 'قطعه', reorderLevel: -1 }),
      ).rejects.toBeTruthy();
      await expect(
        run(SparePartDto, { code: 'P-1', name: 'قطعه', openingQuantity: -3 }),
      ).rejects.toBeTruthy();
    });
  });

  describe('StockMovementDto', () => {
    it('گردشِ مصرف روی دستورِ کار سالم می‌رسد', async () => {
      const out = (await run(StockMovementDto, {
        partId: 'part-1',
        type: StockMovementType.ISSUE,
        quantity: 2,
        unitCost: 1000,
        workOrderId: 'wo-1',
        reference: 'حوالهٔ ۴۴',
        note: 'تعویضِ فیلترِ هواسازِ لابی',
      })) as StockMovementDto;

      expect(out.type).toBe(StockMovementType.ISSUE);
      expect(out.quantity).toBe(2);
      expect(out.workOrderId).toBe('wo-1');
    });

    it('نوعِ ناشناخته رد می‌شود', async () => {
      await expect(
        run(StockMovementDto, {
          partId: 'part-1',
          type: 'steal',
          quantity: 1,
        }),
      ).rejects.toBeTruthy();
    });

    it('تعدادِ صفر یا منفی رد می‌شود', async () => {
      for (const quantity of [0, -1]) {
        await expect(
          run(StockMovementDto, {
            partId: 'part-1',
            type: StockMovementType.RECEIPT,
            quantity,
          }),
        ).rejects.toBeTruthy();
      }
    });

    it('شناسهٔ قطعه لازم است', async () => {
      await expect(
        run(StockMovementDto, {
          type: StockMovementType.RECEIPT,
          quantity: 1,
        }),
      ).rejects.toBeTruthy();
    });
  });

  describe('RecountDto', () => {
    it('شمارشِ صفر مجاز است (قفسهٔ خالی)', async () => {
      const out = (await run(RecountDto, {
        countedQuantity: 0,
        note: 'قفسه خالی بود',
      })) as RecountDto;
      expect(out.countedQuantity).toBe(0);
    });

    it('شمارشِ منفی رد می‌شود', async () => {
      await expect(
        run(RecountDto, { countedQuantity: -1 }),
      ).rejects.toBeTruthy();
    });
  });
});
