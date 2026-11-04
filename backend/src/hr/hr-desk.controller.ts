import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { OrganizationId } from '../common/current-user.decorator';
import { MinRole } from '../common/roles';
import { OrganizationRole } from '../database/entities/organization-user.entity';
import { HrDeskService } from './hr-desk.service';

/**
 * میزِ کارِ منابع انسانی.
 *
 * مسیرِ جدا (`hr/desk`) تا با فهرست‌های موجود قاطی نشود؛ خواندن برای
 * «تحلیل‌گر» به بالا باز است، مثلِ بقیهٔ گزارش‌های HR.
 */
@Controller('hr/desk')
@UseGuards(JwtAuthGuard)
export class HrDeskController {
  constructor(private readonly desk: HrDeskService) {}

  @Get()
  @MinRole(OrganizationRole.ANALYST)
  overview(
    @OrganizationId() organizationId: string,
    @Query('date') date?: string,
  ) {
    return this.desk.desk(organizationId, date);
  }

  /** نشانِ «مرخصیِ معلق» برای منو؛ بدونِ فرستادنِ کلِ میز. */
  @Get('pending/count')
  @MinRole(OrganizationRole.ANALYST)
  pending(@OrganizationId() organizationId: string) {
    return this.desk.pendingCount(organizationId);
  }
}
