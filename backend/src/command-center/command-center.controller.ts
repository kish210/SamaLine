import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser, type JwtUser } from '../common/current-user.decorator';
import { MinRole } from '../common/roles';
import { OrganizationRole } from '../database/entities/organization-user.entity';
import { CommandCenterService } from './command-center.service';

/**
 * میزِ فرماندهی: یک فراخوانی برای کلِ وضعیتِ قابلِ‌اقدامِ هتل.
 *
 * `organizationId` از توکن. از «تحلیل‌گر» به بالا خواندنی است، مثلِ بقیهٔ
 * نماهای گزارشی؛ هیچ نوشتنی اینجا نیست.
 */
@Controller('command-center')
@UseGuards(JwtAuthGuard)
export class CommandCenterController {
  constructor(private readonly desk: CommandCenterService) {}

  @Get()
  @MinRole(OrganizationRole.ANALYST)
  get(
    @CurrentUser() user: JwtUser,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.desk.desk(user.organizationId, { departmentId });
  }
}
