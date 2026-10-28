import { Controller, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser, type JwtUser } from '../common/current-user.decorator';
import { MinRole } from '../common/roles';
import { TenantAccessService } from '../common/tenant-access.service';
import { OrganizationRole } from '../database/entities/organization-user.entity';
import { HotelSetupService } from './hotel-setup.service';

/**
 * راه‌اندازیِ واحدهای استانداردِ هتل. فقط «مدیر»؛ سازمان از توکن و مالکیتِ
 * فضای کاری با TenantAccessService.
 */
@Controller('hotel-setup')
@UseGuards(JwtAuthGuard)
export class HotelSetupController {
  constructor(
    private readonly setup: HotelSetupService,
    private readonly tenant: TenantAccessService,
  ) {}

  @Post('standard-units')
  @MinRole(OrganizationRole.ADMIN)
  async standardUnits(
    @Query('workspaceId') workspaceId: string,
    @CurrentUser() user: JwtUser,
  ) {
    await this.tenant.assertWorkspace(workspaceId, user);
    return this.setup.setupStandardUnits(user.organizationId, workspaceId);
  }

  /** ساختِ خودکارِ داشبورد + پرتال برای یک فرم (مثلاً فرمِ ساخته‌شده با AI). */
  @Post('form-report')
  @MinRole(OrganizationRole.EDITOR)
  async formReport(
    @Query('formId') formId: string,
    @CurrentUser() user: JwtUser,
  ) {
    await this.tenant.assertForm(formId, user);
    return this.setup.autoBuildForForm(user.organizationId, formId);
  }
}
