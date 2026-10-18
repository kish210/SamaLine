import {
  Controller,
  ForbiddenException,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, type JwtUser } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { TenantAccessService } from '../common/tenant-access.service';
import { PlanService } from './plan.service';

@Controller('plans')
@UseGuards(JwtAuthGuard)
export class PlanController {
  constructor(
    private readonly planService: PlanService,
    private readonly tenant: TenantAccessService,
  ) {}

  /** سیاست پلن سازمان خودِ کاربر. */
  @Get('policy')
  myPolicy(@CurrentUser() user: JwtUser) {
    return this.planService.getPolicyByOrganization(user.organizationId);
  }

  /** سیاست پلن یک سازمان مشخص؛ فقط سازمان خود کاربر یا سوپرادمین. */
  @Get('policy/:organizationId')
  async getPolicy(
    @Param('organizationId') organizationId: string,
    @CurrentUser() user: JwtUser,
  ) {
    if (
      organizationId !== user.organizationId &&
      !(await this.tenant.isSuperAdminUser(user))
    ) {
      throw new ForbiddenException('به این سازمان دسترسی ندارید');
    }
    return this.planService.getPolicyByOrganization(organizationId);
  }
}
