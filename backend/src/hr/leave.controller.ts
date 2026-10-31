import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import {
  CurrentUser,
  OrganizationId,
  type JwtUser,
} from '../common/current-user.decorator';
import { MinRole } from '../common/roles';
import { OrganizationRole } from '../database/entities/organization-user.entity';
import {
  LeaveStatus,
  LeaveType,
} from '../database/entities/leave-request.entity';
import { LeaveService, type LeaveListQuery } from './leave.service';

class LeaveDto {
  @IsNotEmpty() @IsString() personnelId: string;

  @IsOptional() @IsIn(Object.values(LeaveType)) type?: LeaveType;

  @IsNotEmpty() @IsString() @MaxLength(10) fromDate: string;
  @IsNotEmpty() @IsString() @MaxLength(10) toDate: string;

  @IsOptional() @IsString() @MaxLength(1000) reason?: string;

  /** فقط برای مرخصیِ ساعتی. */
  @IsOptional() @IsNumber() @Min(0) days?: number;
}

class DecisionDto {
  @IsIn([LeaveStatus.APPROVED, LeaveStatus.REJECTED, LeaveStatus.CANCELLED])
  status: LeaveStatus;

  @IsOptional() @IsString() @MaxLength(500) note?: string;
}

class BalanceDto {
  @IsNotEmpty() @IsString() personnelId: string;
  @IsInt() @Min(1300) year: number;
  @IsOptional() @IsIn(Object.values(LeaveType)) type?: LeaveType;
  @IsNumber() @Min(0) entitledDays: number;
}

/**
 * مرخصی و ماندهٔ آن.
 *
 * خواندن برای هر کاربرِ واردشده‌ی سازمان باز است (کارمند باید درخواستِ خودش
 * را ببیند)، ثبت هم همین‌طور؛ ولی **تصمیم** و تعیینِ سقف فقط «مدیر» به بالا.
 */
@Controller('hr/leaves')
@UseGuards(JwtAuthGuard)
export class LeaveController {
  constructor(private readonly service: LeaveService) {}

  @Get('summary')
  @MinRole(OrganizationRole.ANALYST)
  summary(@OrganizationId() organizationId: string) {
    return this.service.summary(organizationId);
  }

  @Get()
  list(
    @OrganizationId() organizationId: string,
    @Query() query: LeaveListQuery,
  ) {
    return this.service.list(organizationId, query);
  }

  @Get(':id')
  get(@OrganizationId() organizationId: string, @Param('id') id: string) {
    return this.service.get(organizationId, id);
  }

  @Post()
  create(
    @OrganizationId() organizationId: string,
    @Body() dto: LeaveDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.create(organizationId, dto, user.sub);
  }

  /** تأیید/رد/لغو — تصمیمِ مدیر. */
  @Patch(':id/decision')
  @MinRole(OrganizationRole.ADMIN)
  decide(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: DecisionDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.decide(organizationId, id, dto.status, {
      note: dto.note,
      actorId: user.sub,
    });
  }

  @Get('balance/:personnelId')
  balance(
    @OrganizationId() organizationId: string,
    @Param('personnelId') personnelId: string,
    @Query('year') year?: string,
  ) {
    const y = Number(year) || new Date().getFullYear();
    return this.service.balanceOf(organizationId, personnelId, y);
  }

  @Post('balance')
  @MinRole(OrganizationRole.ADMIN)
  setBalance(
    @OrganizationId() organizationId: string,
    @Body() dto: BalanceDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.service.setBalance(organizationId, dto, user.sub);
  }
}
