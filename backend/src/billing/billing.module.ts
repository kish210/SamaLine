import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoiceEntity } from '../database/entities/invoice.entity';
import { OnPremLicenseEntity } from '../database/entities/onprem-license.entity';
import { PaymentEntity } from '../database/entities/payment.entity';
import { SubscriptionEntity } from '../database/entities/subscription.entity';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InvoiceEntity,
      PaymentEntity,
      SubscriptionEntity,
      OnPremLicenseEntity,
    ]),
  ],
  controllers: [BillingController],
  providers: [BillingService],
})
export class BillingModule {}
