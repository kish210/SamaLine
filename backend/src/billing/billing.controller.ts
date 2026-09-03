import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { BillingService } from './billing.service';
import {
  CreateInvoiceDto,
  CreateLicenseDto,
  CreatePaymentDto,
  UpdateSubscriptionDto,
  VerifyPaymentDto,
} from './dto';

@Controller('billing')
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('invoices')
  createInvoice(@Body() dto: CreateInvoiceDto) {
    return this.billingService.createInvoice(dto);
  }

  @Get('invoices')
  listInvoices(@Query('organizationId') organizationId: string) {
    return this.billingService.listInvoices(organizationId);
  }

  @Post('payments')
  createPayment(@Body() dto: CreatePaymentDto) {
    return this.billingService.createPayment(dto);
  }

  @Patch('payments/:id/verify')
  verifyPayment(@Param('id') id: string, @Body() dto: VerifyPaymentDto) {
    return this.billingService.verifyPayment(id, dto);
  }

  @Post('subscriptions')
  updateSubscription(@Body() dto: UpdateSubscriptionDto) {
    return this.billingService.updateSubscription(dto);
  }

  @Get('subscriptions')
  listSubscriptions(@Query('organizationId') organizationId: string) {
    return this.billingService.listSubscriptions(organizationId);
  }

  @Post('licenses')
  createLicense(@Body() dto: CreateLicenseDto) {
    return this.billingService.createLicense(dto);
  }

  @Get('licenses')
  listLicenses(@Query('organizationId') organizationId: string) {
    return this.billingService.listLicenses(organizationId);
  }
}
