import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { SuperAdminGuard } from '../common/super-admin.guard';
import { PlanCode } from '../database/entities/plan-policy.entity';
import { AdminService } from './admin.service';

class SetPlanDto {
  @IsIn(Object.values(PlanCode))
  planCode: PlanCode;

  /** تاریخ پایان اشتراک (ISO)؛ خالی یعنی بدون انقضا. */
  @IsOptional()
  @IsString()
  expiresAt?: string;
}

/**
 * پنل ادمین کل.
 *
 * پیش از این فقط JwtAuthGuard داشت؛ یعنی هر کاربر واردشده فهرست همه‌ی
 * سازمان‌های سکو، پلن و مصرفشان را می‌دید.
 */
@Controller('admin')
@UseGuards(JwtAuthGuard, SuperAdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('organizations-overview')
  overview() {
    return this.adminService.organizationsOverview();
  }

  /**
   * تعیین پلن یک سازمان.
   *
   * تنها راه تغییر پلن است: فعال‌سازی پس از دریافت وجه (یا قرارداد) با
   * گرداننده‌ی سکوست، نه با خود سازمان.
   */
  @Patch('organizations/:id/plan')
  setPlan(@Param('id') id: string, @Body() dto: SetPlanDto) {
    return this.adminService.setPlan(id, dto.planCode, dto.expiresAt);
  }
}
