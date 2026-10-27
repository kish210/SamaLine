import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { OrganizationId } from '../common/current-user.decorator';
import { MinRole } from '../common/roles';
import { OrganizationRole } from '../database/entities/organization-user.entity';
import { StaffNotifyService } from './staff-notify.service';

class AnnouncementDto {
  @IsString() @MinLength(1) @MaxLength(120) title: string;
  @IsString() @MinLength(1) @MaxLength(3000) body: string;
  /** محدود به یک بخش؛ خالی یعنی همهٔ پرسنلِ وصل‌به‌ربات. */
  @IsOptional() @IsString() departmentId?: string | null;
}

/**
 * اطلاعیهٔ سازمانی به رباتِ پرسنل (فاز F).
 *
 * فقط «مدیر» (یا بالاتر) می‌فرستد. به گفتگوی بله/تلگرامِ پرسنلِ وصل‌به‌ربات
 * می‌رود. `organizationId` همیشه از توکن. در ماژولِ اینتگریشن است تا چرخهٔ
 * ماژولی با HR پیش نیاید.
 */
@Controller('hr/announcements')
@UseGuards(JwtAuthGuard)
export class AnnouncementsController {
  constructor(private readonly staffNotify: StaffNotifyService) {}

  @Post()
  @MinRole(OrganizationRole.ADMIN)
  send(
    @Body() dto: AnnouncementDto,
    @OrganizationId() organizationId: string,
  ) {
    return this.staffNotify.broadcastAnnouncement({
      organizationId,
      title: dto.title,
      body: dto.body,
      departmentId: dto.departmentId ?? null,
    });
  }
}
