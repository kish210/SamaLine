jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
  InjectDataSource: () => () => undefined,
  getRepositoryToken: (entity: unknown) => entity,
  TypeOrmModule: { forFeature: () => ({}), forRoot: () => ({}) },
}));

import type { DataSource } from 'typeorm';
import {
  InvoiceEntity,
  InvoiceStatus,
} from '../database/entities/invoice.entity';
import { OnPremLicenseEntity } from '../database/entities/onprem-license.entity';
import {
  PaymentEntity,
  PaymentStatus,
} from '../database/entities/payment.entity';
import { OrganizationEntity } from '../database/entities/organization.entity';
import { SubscriptionEntity } from '../database/entities/subscription.entity';
import { createTestDataSource } from '../testing/test-database';
import { BillingService } from './billing.service';
import { LocalPaymentProvider } from './payment-provider';

describe('BillingService — پرداخت', () => {
  let ds: DataSource;
  let service: BillingService;
  let organizationId: string;

  beforeEach(async () => {
    ds = await createTestDataSource();
    organizationId = (
      await ds.getRepository(OrganizationEntity).save({ name: 'سازمان' })
    ).id;

    service = new BillingService(
      ds.getRepository(InvoiceEntity),
      ds.getRepository(PaymentEntity),
      ds.getRepository(SubscriptionEntity),
      ds.getRepository(OnPremLicenseEntity),
    );
  });

  afterEach(async () => {
    await ds.destroy();
  });

  const newInvoice = (amount = 500000) =>
    service.createInvoice({ organizationId, amount });

  describe('شروع پرداخت', () => {
    it('مبلغ را از فاکتور می‌گیرد نه از ورودی کلاینت', async () => {
      const invoice = await newInvoice(500000);

      const started = await service.createPayment({
        invoiceId: invoice.id,
        gateway: 'هرچه',
        // کلاینت مبلغ ناچیز می‌فرستد؛ باید نادیده گرفته شود.
        amount: 1,
      });

      expect(started.amount).toBe(500000);
      expect(started.redirectUrl).toContain('authority=');
    });

    it('شناسه تراکنش درگاه را ذخیره می‌کند', async () => {
      const invoice = await newInvoice();
      const started = await service.createPayment({
        invoiceId: invoice.id,
        gateway: 'x',
        amount: 0,
      });

      const payment = await ds
        .getRepository(PaymentEntity)
        .findOneByOrFail({ id: started.paymentId });
      expect(payment.authority).toBeTruthy();
      expect(payment.status).toBe(PaymentStatus.PENDING);
    });

    it('فاکتور پرداخت‌شده را دوباره پرداخت نمی‌کند', async () => {
      const invoice = await newInvoice();
      await ds
        .getRepository(InvoiceEntity)
        .update(invoice.id, { status: InvoiceStatus.PAID });

      await expect(
        service.createPayment({
          invoiceId: invoice.id,
          gateway: 'x',
          amount: 0,
        }),
      ).rejects.toThrow('این فاکتور قبلا پرداخت شده است');
    });

    it('فاکتور ناموجود را رد می‌کند', async () => {
      await expect(
        service.createPayment({
          invoiceId: '00000000-0000-0000-0000-000000000000',
          gateway: 'x',
          amount: 0,
        }),
      ).rejects.toThrow('فاکتور یافت نشد');
    });
  });

  describe('تایید پرداخت', () => {
    it('وضعیت را از درگاه می‌گیرد نه از کلاینت', async () => {
      const invoice = await newInvoice();
      const started = await service.createPayment({
        invoiceId: invoice.id,
        gateway: 'x',
        amount: 0,
      });

      // کلاینت ادعای شکست می‌کند، ولی درگاه محلی موفق می‌گوید.
      const verified = await service.verifyPayment(started.paymentId);

      expect(verified.status).toBe(PaymentStatus.SUCCESS);
      expect(verified.referenceCode).toContain('LOCAL-');
    });

    it('فاکتور را پس از پرداخت موفق تسویه می‌کند', async () => {
      const invoice = await newInvoice();
      const started = await service.createPayment({
        invoiceId: invoice.id,
        gateway: 'x',
        amount: 0,
      });

      await service.verifyPayment(started.paymentId);

      const stored = await ds
        .getRepository(InvoiceEntity)
        .findOneByOrFail({ id: invoice.id });
      expect(stored.status).toBe(InvoiceStatus.PAID);
    });

    it('پرداختی که به درگاه نرفته را تایید نمی‌کند', async () => {
      const invoice = await newInvoice();
      const payment = await ds.getRepository(PaymentEntity).save({
        invoiceId: invoice.id,
        gateway: 'x',
        status: PaymentStatus.PENDING,
        amount: '1000',
      });

      await expect(service.verifyPayment(payment.id)).rejects.toThrow(
        'این پرداخت هنوز به درگاه نرفته است',
      );
    });

    it('پرداخت تاییدشده دوباره تایید نمی‌شود', async () => {
      const invoice = await newInvoice();
      const started = await service.createPayment({
        invoiceId: invoice.id,
        gateway: 'x',
        amount: 0,
      });

      const first = await service.verifyPayment(started.paymentId);
      const second = await service.verifyPayment(started.paymentId);

      expect(second.referenceCode).toBe(first.referenceCode);
    });

    it('پرداخت ناموجود را رد می‌کند', async () => {
      await expect(
        service.verifyPayment('00000000-0000-0000-0000-000000000000'),
      ).rejects.toThrow('پرداخت یافت نشد');
    });
  });
});

describe('LocalPaymentProvider', () => {
  it('مبلغ ناهمخوان را رد می‌کند', async () => {
    const provider = new LocalPaymentProvider();
    await provider.start({
      paymentId: 'p1',
      amount: 1000,
      description: 'تست',
      callbackUrl: 'http://localhost/cb',
    });

    const result = await provider.verify({
      authority: 'local-p1',
      amount: 5,
    });

    expect(result.paid).toBe(false);
    expect(result.message).toContain('مبلغ');
  });

  it('مبلغ درست را تایید می‌کند', async () => {
    const provider = new LocalPaymentProvider();
    const started = await provider.start({
      paymentId: 'p2',
      amount: 2000,
      description: 'تست',
      callbackUrl: 'http://localhost/cb',
    });

    await expect(
      provider.verify({ authority: started.authority, amount: 2000 }),
    ).resolves.toMatchObject({ paid: true });
  });
});
