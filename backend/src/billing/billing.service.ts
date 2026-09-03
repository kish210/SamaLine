import { Injectable, NotFoundException } from '@nestjs/common';
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
  VerifyPaymentDto,
} from './dto';

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

  async createPayment(dto: CreatePaymentDto) {
    const invoice = await this.invoiceRepo.findOne({
      where: { id: dto.invoiceId },
    });
    if (!invoice) throw new NotFoundException('فاکتور یافت نشد');

    return this.paymentRepo.save(
      this.paymentRepo.create({
        invoiceId: dto.invoiceId,
        gateway: dto.gateway,
        status: PaymentStatus.PENDING,
        amount: String(Math.max(0, Math.floor(dto.amount ?? 0))),
      }),
    );
  }

  async verifyPayment(id: string, dto: VerifyPaymentDto) {
    const payment = await this.paymentRepo.findOne({ where: { id } });
    if (!payment) throw new NotFoundException('پرداخت یافت نشد');

    payment.status =
      dto.status === 'success' ? PaymentStatus.SUCCESS : PaymentStatus.FAILED;
    payment.referenceCode = dto.referenceCode ?? payment.referenceCode;
    await this.paymentRepo.save(payment);

    if (payment.status === PaymentStatus.SUCCESS) {
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
