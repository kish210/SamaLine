import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import {
  CurrentUser,
  OrganizationId,
  type JwtUser,
} from '../common/current-user.decorator';
import { MinRole } from '../common/roles';
import { OrganizationRole } from '../database/entities/organization-user.entity';
import { AnnouncementService } from './announcement.service';

class AnnouncementDto {
  @IsString() @MinLength(1) @MaxLength(120) title: string;
  @IsString() @MinLength(1) @MaxLength(3000) body: string;
  /** محدود به یک بخش؛ خالی یعنی همهٔ پرسنلِ وصل‌به‌ربات. */
  @IsOptional() @IsString() departmentId?: string | null;
}

/**
 * اطلاعیهٔ سازمانی (فاز F/G): ارسال به بله + ثبتِ ماندگار + تاریخچه.
 *
 * خواندنِ تاریخچه برای هر کاربرِ واردشده؛ ارسال فقط «مدیر» (یا بالاتر).
 * `organizationId` همیشه از توکن. در ماژولِ اینتگریشن است تا چرخهٔ ماژولی با HR
 * پیش نیاید.
 */
@Controller('hr/announcements')
@UseGuards(JwtAuthGuard)
export class AnnouncementsController {
  constructor(private readonly announcements: AnnouncementService) {}

  @Get()
  list(@OrganizationId() organizationId: string) {
    return this.announcements.list(organizationId);
  }

  @Post()
  @MinRole(OrganizationRole.ADMIN)
  send(
    @Body() dto: AnnouncementDto,
    @OrganizationId() organizationId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.announcements.create(organizationId, user.email, {
      title: dto.title,
      body: dto.body,
      departmentId: dto.departmentId ?? null,
    });
  }
}
