import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser, type JwtUser } from '../common/current-user.decorator';
import { MinRole } from '../common/roles';
import { TenantAccessService } from '../common/tenant-access.service';
import { OrganizationRole } from '../database/entities/organization-user.entity';
import { OverviewService } from './overview.service';

/**
 * نمای کلیِ مدیریتی (داشبوردِ مدیر). تحلیل‌گر به بالا؛ اسکوپِ بخش از عضویتِ
 * کاربر، سازمان از توکن و مالکیتِ فضای کاری با TenantAccessService.
 */
@Controller('reports/overview')
@UseGuards(JwtAuthGuard)
export class OverviewController {
  constructor(
    private readonly overview: OverviewService,
    private readonly tenant: TenantAccessService,
  ) {}

  @Get()
  @MinRole(OrganizationRole.ANALYST)
  async get(
    @Query('workspaceId') workspaceId: string,
    @Query('days') days: string | undefined,
    @CurrentUser() user: JwtUser,
  ) {
    await this.tenant.assertWorkspace(workspaceId, user);
    return this.overview.overview(
      user.organizationId,
      workspaceId,
      {
        isManager: this.tenant.isManager(user),
        departmentIds: await this.tenant.memberDepartmentIds(user.sub),
      },
      days ? Number(days) : 30,
    );
  }
}
