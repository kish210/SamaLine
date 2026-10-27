import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { OrganizationId } from '../common/current-user.decorator';
import { MinRole } from '../common/roles';
import { OrganizationRole } from '../database/entities/organization-user.entity';
import type { PersonnelDocument } from '../database/entities/personnel.entity';
import { HrService } from './hr.service';
import { HrStatsService } from './hr-stats.service';

class PersonnelDto {
  @IsOptional() @IsString() @MaxLength(120) fullName?: string;
  @IsOptional() @IsString() @MaxLength(25) mobile?: string;
  @IsOptional() @IsString() @MaxLength(40) employeeNo?: string;
  @IsOptional() @IsString() @MaxLength(80) position?: string;
  @IsOptional() @IsString() departmentId?: string | null;
  @IsOptional() @IsString() @MaxLength(10) hireDate?: string;
  @IsOptional() @IsArray() documents?: PersonnelDocument[];
  @IsOptional() @IsString() @MaxLength(4000) notes?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

/**
 * پروندهٔ پرسنل (HR). خواندن برای هر کاربرِ واردشده‌ی سازمان؛ تغییرِ داده‌ی
 * پایه فقط «مدیر» (یا بالاتر). `organizationId` همیشه از توکن.
 */
@Controller('hr/personnel')
@UseGuards(JwtAuthGuard)
export class HrController {
  constructor(
    private readonly service: HrService,
    private readonly stats: HrStatsService,
  ) {}

  @Get()
  list(@OrganizationId() organizationId: string) {
    return this.service.list(organizationId);
  }

  /** گزارش: خلاصهٔ درخواست‌های هر پرسنل (کلِ، در انتظار، تأیید، رد). */
  @Get('request-stats')
  @MinRole(OrganizationRole.ANALYST)
  requestStats(@OrganizationId() organizationId: string) {
    return this.stats.requestStats(organizationId);
  }

  @Post()
  @MinRole(OrganizationRole.ADMIN)
  create(@Body() dto: PersonnelDto, @OrganizationId() organizationId: string) {
    return this.service.create(organizationId, dto);
  }

  @Patch(':id')
  @MinRole(OrganizationRole.ADMIN)
  update(
    @Param('id') id: string,
    @Body() dto: PersonnelDto,
    @OrganizationId() organizationId: string,
  ) {
    return this.service.update(organizationId, id, dto);
  }

  @Delete(':id')
  @MinRole(OrganizationRole.ADMIN)
  remove(@Param('id') id: string, @OrganizationId() organizationId: string) {
    return this.service.remove(organizationId, id);
  }
}
