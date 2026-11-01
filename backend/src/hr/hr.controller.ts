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
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { OrganizationId } from '../common/current-user.decorator';
import { MinRole } from '../common/roles';
import { OrganizationRole } from '../database/entities/organization-user.entity';
import {
  ContractType,
  EmploymentStatus,
} from '../database/entities/personnel.entity';
import type { PersonnelDocument } from '../database/entities/personnel.entity';
import { HrService } from './hr.service';
import { HrStatsService } from './hr-stats.service';

/** اتصالِ حسابِ ورودِ پنل به پروندهٔ پرسنل؛ `null` یعنی قطع. */
class UserLinkDto {
  @IsOptional() @IsString() userId?: string | null;
}

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

  /** وضعیتِ اشتغال و قرارداد (فاز HR). */
  @IsOptional()
  @IsIn(Object.values(EmploymentStatus))
  employmentStatus?: EmploymentStatus;

  @IsOptional()
  @IsIn(Object.values(ContractType))
  contractType?: ContractType;

  @IsOptional() @IsString() @MaxLength(10) contractEndsAt?: string;
  @IsOptional() @IsString() @MaxLength(10) terminatedAt?: string;
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
    return this.service.listWithLinks(organizationId);
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

  /**
   * اتصالِ حسابِ کاربری به پروندهٔ پرسنل.
   *
   * کارِ منابع انسانی است، نه خودِ کاربر: این اتصال تعیین می‌کند «کدام
   * پرسنل هستم» و اگر خودسرویس بود، هر کسی می‌توانست خودش را به پروندهٔ
   * دیگری بچسباند و شیفت، مرخصی و نامه‌های او را ببیند.
   *
   * پیش از `@Patch(':id')` می‌آید، وگرنه مسیرِ عمومی آن را می‌پوشاند.
   */
  @Patch(':id/user-link')
  @MinRole(OrganizationRole.ADMIN)
  setUserLink(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: UserLinkDto,
  ) {
    return this.service.setUserLink(organizationId, id, dto.userId ?? null);
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
