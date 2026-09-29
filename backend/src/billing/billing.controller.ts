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
import { SuperAdminGuard } from '../common/super-admin.guard';
import { BillingService } from './billing.service';
import {
  CreateInvoiceDto,
  CreateLicenseDto,
  CreatePaymentDto,
  UpdateSubscriptionDto,
  ValidateLicenseDto,
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
  createPayment(
    @Body() dto: CreatePaymentDto,
    @OrganizationId() organizationId: string,
  ) {
    // فاکتور باید متعلق به سازمان همین کاربر باشد.
    return this.billingService.createPayment(dto, organizationId);
  }

  @Patch('payments/:id/verify')
  verifyPayment(
    @Param('id') id: string,
    @OrganizationId() organizationId: string,
  ) {
    // وضعیت از خود درگاه پرسیده می‌شود؛ بدنه‌ی درخواست نقشی ندارد.
    return this.billingService.verifyPayment(id, organizationId);
  }

  /**
   * تغییر پلن — فقط سوپرادمین.
   *
   * پیش از این هر کاربری می‌توانست پلن سازمان خودش را بی‌پرداخت به
   * «اختصاصی» ببرد و همه‌ی سقف‌ها را دور بزند. سوپرادمین می‌تواند
   * `organizationId` را در بدنه بدهد؛ بدون آن، سازمان خودش.
   */
  @Post('subscriptions')
  @UseGuards(SuperAdminGuard)
  updateSubscription(
    @Body() dto: UpdateSubscriptionDto,
    @OrganizationId() organizationId: string,
  ) {
    return this.billingService.updateSubscription({
      ...dto,
      organizationId: dto.organizationId ?? organizationId,
    });
  }

  @Get('subscriptions')
  listSubscriptions(@OrganizationId() organizationId: string) {
    return this.billingService.listSubscriptions(organizationId);
  }

  /** صدور لایسنس On-Premise — فقط سوپرادمین. */
  @Post('licenses')
  @UseGuards(SuperAdminGuard)
  createLicense(
    @Body() dto: CreateLicenseDto,
    @OrganizationId() organizationId: string,
  ) {
    return this.billingService.createLicense({
      ...dto,
      organizationId: dto.organizationId ?? organizationId,
    });
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
