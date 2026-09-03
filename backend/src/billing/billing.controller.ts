import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { OrganizationId } from '../common/current-user.decorator';
import { BillingService } from './billing.service';
import {
  CreateInvoiceDto,
  CreateLicenseDto,
  CreatePaymentDto,
  UpdateSubscriptionDto,
  ValidateLicenseDto,
  VerifyPaymentDto,
} from './dto';

@Controller('billing')
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('invoices')
  createInvoice(
    @Body() dto: CreateInvoiceDto,
    @OrganizationId() organizationId: string,
  ) {
    return this.billingService.createInvoice({ ...dto, organizationId });
  }

  @Get('invoices')
  listInvoices(@OrganizationId() organizationId: string) {
    return this.billingService.listInvoices(organizationId);
  }

  @Post('payments')
  createPayment(@Body() dto: CreatePaymentDto) {
    // سازمان از روی فاکتور مرجع تعیین می‌شود، نه از ورودی کلاینت.
    return this.billingService.createPayment(dto);
  }

  @Patch('payments/:id/verify')
  verifyPayment(@Param('id') id: string, @Body() dto: VerifyPaymentDto) {
    return this.billingService.verifyPayment(id, dto);
  }

  @Post('subscriptions')
  updateSubscription(
    @Body() dto: UpdateSubscriptionDto,
    @OrganizationId() organizationId: string,
  ) {
    return this.billingService.updateSubscription({ ...dto, organizationId });
  }

  @Get('subscriptions')
  listSubscriptions(@OrganizationId() organizationId: string) {
    return this.billingService.listSubscriptions(organizationId);
  }

  @Post('licenses')
  createLicense(
    @Body() dto: CreateLicenseDto,
    @OrganizationId() organizationId: string,
  ) {
    return this.billingService.createLicense({ ...dto, organizationId });
  }

  @Post('licenses/validate')
  validateLicense(@Body() dto: ValidateLicenseDto) {
    return this.billingService.validateLicense(dto.licenseKey);
  }

  @Get('licenses')
  listLicenses(@OrganizationId() organizationId: string) {
    return this.billingService.listLicenses(organizationId);
  }
}
