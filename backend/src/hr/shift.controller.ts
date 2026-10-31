import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser, type JwtUser } from '../common/current-user.decorator';
import { MinRole } from '../common/roles';
import { OrganizationRole } from '../database/entities/organization-user.entity';
import {
  AttendanceSource,
  AttendanceStatus,
} from '../database/entities/work-shift.entity';
import { ShiftService, shiftDate, todayIso } from './shift.service';

class ShiftTemplateDto {
  @IsNotEmpty() @IsString() @MaxLength(80) name: string;
  @IsNotEmpty() @IsString() @MaxLength(5) startTime: string;
  @IsNotEmpty() @IsString() @MaxLength(5) endTime: string;
  @IsOptional() @IsString() departmentId?: string | null;
  @IsOptional() @IsString() @MaxLength(16) color?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

class AssignShiftDto {
  @IsNotEmpty() @IsString() personnelId: string;
  @IsNotEmpty() @IsString() @MaxLength(10) date: string;
  @IsOptional() @IsString() templateId?: string | null;
  @IsOptional() @IsString() @MaxLength(5) startTime?: string;
  @IsOptional() @IsString() @MaxLength(5) endTime?: string;
  @IsOptional() @IsString() @MaxLength(80) label?: string;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

class AttendanceDto {
  @IsNotEmpty() @IsString() personnelId: string;
  @IsNotEmpty() @IsString() @MaxLength(10) date: string;

  @IsOptional()
  @IsIn(Object.values(AttendanceStatus))
  status?: AttendanceStatus;

  @IsOptional() @IsString() @MaxLength(5) checkIn?: string;
  @IsOptional() @IsString() @MaxLength(5) checkOut?: string;
  @IsOptional() @IsString() @MaxLength(300) note?: string;
}

/**
 * APIهای برنامهٔ کار و حضور.
 *
 * `organizationId` همیشه از توکن. خواندن برای «تحلیل‌گر» به بالا، نوشتنِ
 * برنامه و حضور از «ویرایشگر» به بالا (سرشیفت)، و الگوی شیفت از «مدیر» به
 * بالا چون ساختارِ کارِ کلِ هتل را تعیین می‌کند.
 */
@Controller('shifts')
@UseGuards(JwtAuthGuard)
export class ShiftController {
  constructor(private readonly shifts: ShiftService) {}

  /** میزِ کارِ روز: شیفت + حضور + مرخصی، کنار هم. */
  @Get('day')
  @MinRole(OrganizationRole.ANALYST)
  dayBoard(
    @CurrentUser() user: JwtUser,
    @Query('date') date?: string,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.shifts.dayBoard(user.organizationId, date || todayIso(), {
      departmentId,
    });
  }

  /** برنامهٔ بازه؛ پیش‌فرض یک هفته از امروز. */
  @Get('roster')
  @MinRole(OrganizationRole.ANALYST)
  roster(
    @CurrentUser() user: JwtUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('personnelId') personnelId?: string,
    @Query('departmentId') departmentId?: string,
  ) {
    const start = from || todayIso();
    return this.shifts.roster(
      user.organizationId,
      start,
      to || shiftDate(start, 6),
      { personnelId, departmentId },
    );
  }

  @Get('templates')
  @MinRole(OrganizationRole.ANALYST)
  listTemplates(@CurrentUser() user: JwtUser) {
    return this.shifts.listTemplates(user.organizationId);
  }

  @Post('templates')
  @MinRole(OrganizationRole.ADMIN)
  createTemplate(
    @CurrentUser() user: JwtUser,
    @Body() dto: ShiftTemplateDto,
  ) {
    return this.shifts.createTemplate(user.organizationId, dto, user.sub);
  }

  @Patch('templates/:id')
  @MinRole(OrganizationRole.ADMIN)
  updateTemplate(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: Partial<ShiftTemplateDto>,
  ) {
    return this.shifts.updateTemplate(user.organizationId, id, dto, user.sub);
  }

  @Post('assign')
  @MinRole(OrganizationRole.EDITOR)
  assign(@CurrentUser() user: JwtUser, @Body() dto: AssignShiftDto) {
    return this.shifts.assign(user.organizationId, dto, user.sub);
  }

  @Delete('assign/:id')
  @MinRole(OrganizationRole.EDITOR)
  remove(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.shifts.removeAssignment(user.organizationId, id, user.sub);
  }

  /** ثبت یا اصلاحِ حضورِ یک روز. */
  @Post('attendance')
  @MinRole(OrganizationRole.EDITOR)
  setAttendance(@CurrentUser() user: JwtUser, @Body() dto: AttendanceDto) {
    return this.shifts.setAttendance(
      user.organizationId,
      { ...dto, source: AttendanceSource.MANUAL },
      user.sub,
    );
  }

  /** حضورِ یک پرسنل در بازه؛ پیش‌فرض ۳۰ روزِ گذشته. */
  @Get('attendance/:personnelId')
  @MinRole(OrganizationRole.ANALYST)
  attendanceOf(
    @CurrentUser() user: JwtUser,
    @Param('personnelId') personnelId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const end = to || todayIso();
    return this.shifts.attendanceSummary(
      user.organizationId,
      personnelId,
      from || shiftDate(end, -29),
      end,
    );
  }
}
