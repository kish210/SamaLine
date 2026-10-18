import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import {
  InvoiceEntity,
  InvoiceStatus,
} from '../database/entities/invoice.entity';
import { OnPremLicenseEntity } from '../database/entities/onprem-license.entity';
import {
  PaymentEntity,
  PaymentStatus,
} from '../database/entities/payment.entity';
import { SubscriptionEntity } from '../database/entities/subscription.entity';
import {
  CreateInvoiceDto,
  CreateLicenseDto,
  CreatePaymentDto,
  UpdateSubscriptionDto,
} from './dto';
import {
  type PaymentProvider,
  resolvePaymentProvider,
} from './payment-provider';

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(InvoiceEntity)
    private readonly invoiceRepo: Repository<InvoiceEntity>,
    @InjectRepository(PaymentEntity)
    private readonly paymentRepo: Repository<PaymentEntity>,
    @InjectRepository(SubscriptionEntity)
    private readonly subscriptionRepo: Repository<SubscriptionEntity>,
    @InjectRepository(OnPremLicenseEntity)
    private readonly licenseRepo: Repository<OnPremLicenseEntity>,
  ) {}

  /** درگاه فعال؛ از متغیر محیطی انتخاب می‌شود. */
  private readonly payments: PaymentProvider = resolvePaymentProvider();

  async createInvoice(dto: CreateInvoiceDto) {
    const invoiceNo = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    return this.invoiceRepo.save(
      this.invoiceRepo.create({
        organizationId: dto.organizationId,
        invoiceNo,
        status: InvoiceStatus.ISSUED,
        amount: String(Math.max(0, Math.floor(dto.amount ?? 0))),
        metadata: dto.metadata ?? {},
      }),
    );
  }

  listInvoices(organizationId: string) {
    return this.invoiceRepo.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * شروع پرداخت: رکورد ساخته می‌شود و کاربر به درگاه فرستاده می‌شود.
   * مبلغ از فاکتور خوانده می‌شود نه از ورودی کلاینت.
   */
  async createPayment(dto: CreatePaymentDto, organizationId: string) {
    const invoice = await this.invoiceRepo.findOne({
      where: { id: dto.invoiceId, organizationId },
    });
    if (!invoice) throw new NotFoundException('فاکتور یافت نشد');

    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('این فاکتور قبلا پرداخت شده است');
    }

    const amount = Number(invoice.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('مبلغ فاکتور معتبر نیست');
    }

    const payment = await this.paymentRepo.save(
      this.paymentRepo.create({
        invoiceId: dto.invoiceId,
        gateway: this.payments.name,
        status: PaymentStatus.PENDING,
        amount: String(amount),
      }),
    );

    const started = await this.payments.start({
      paymentId: payment.id,
      amount,
      description: `پرداخت فاکتور ${invoice.invoiceNo}`,
      callbackUrl: `${process.env.PAYMENT_CALLBACK_URL ?? 'http://localhost:5174/billing/callback'}?paymentId=${payment.id}`,
    });

    payment.authority = started.authority;
    await this.paymentRepo.save(payment);

    return {
      paymentId: payment.id,
      amount,
      redirectUrl: started.redirectUrl,
      gateway: this.payments.name,
    };
  }

  /**
   * تایید پرداخت — وضعیت از خود درگاه پرسیده می‌شود.
   *
   * پیش از این، کلاینت وضعیت موفق/ناموفق را می‌فرستاد؛ یعنی هر کسی
   * می‌توانست فاکتور را تسویه‌شده اعلام کند.
   */
  async verifyPayment(id: string, organizationId: string) {
    const payment = await this.paymentRepo.findOne({ where: { id } });
    if (!payment) throw new NotFoundException('پرداخت یافت نشد');
    // پرداختِ فاکتور سازمان دیگر برای این کاربر «یافت نشد» است.
    const owner = await this.invoiceRepo.findOne({
      where: { id: payment.invoiceId, organizationId },
    });
    if (!owner) throw new NotFoundException('پرداخت یافت نشد');

    // پرداخت تاییدشده دوباره تایید نمی‌شود تا فاکتور دوبار تسویه نشود.
    if (payment.status === PaymentStatus.SUCCESS) {
      return payment;
    }
    if (!payment.authority) {
      throw new BadRequestException('این پرداخت هنوز به درگاه نرفته است');
    }

    const result = await this.payments.verify({
      authority: payment.authority,
      amount: Number(payment.amount),
    });

    payment.status = result.paid ? PaymentStatus.SUCCESS : PaymentStatus.FAILED;
    payment.referenceCode = result.referenceCode;
    payment.metadata = { ...payment.metadata, message: result.message };
    await this.paymentRepo.save(payment);

    if (result.paid) {
      const invoice = await this.invoiceRepo.findOne({
        where: { id: payment.invoiceId },
      });
      if (invoice) {
        invoice.status = InvoiceStatus.PAID;
        await this.invoiceRepo.save(invoice);
      }
    }

    return payment;
  }

  async updateSubscription(dto: UpdateSubscriptionDto) {
    await this.subscriptionRepo.update(
      { organizationId: dto.organizationId, isActive: true },
      { isActive: false },
    );

    const subscription = this.subscriptionRepo.create({
      organizationId: dto.organizationId,
      planCode: dto.planCode,
      isActive: true,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
    });

    return this.subscriptionRepo.save(subscription);
  }

  listSubscriptions(organizationId: string) {
    return this.subscriptionRepo.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
  }

  async createLicense(dto: CreateLicenseDto) {
    const licenseKey = `SL-ONPREM-${randomBytes(8).toString('hex').toUpperCase()}`;
    return this.licenseRepo.save(
      this.licenseRepo.create({
        organizationId: dto.organizationId,
        licenseKey,
        capabilities: dto.capabilities,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        isActive: true,
      }),
    );
  }

  async validateLicense(licenseKey: string) {
    const license = await this.licenseRepo.findOne({ where: { licenseKey } });
    if (!license || !license.isActive) {
      return { valid: false, reason: 'لایسنس معتبر نیست' };
    }

    if (license.expiresAt && license.expiresAt < new Date()) {
      return { valid: false, reason: 'لایسنس منقضی شده است' };
    }

    return {
      valid: true,
      organizationId: license.organizationId,
      capabilities: license.capabilities,
      expiresAt: license.expiresAt,
    };
  }
  listLicenses(organizationId: string) {
    return this.licenseRepo.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
  }
}
