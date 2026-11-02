import {
  Body,
  Controller,
  ForbiddenException,
  Inject,
  Optional,
  forwardRef,
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
import { MinRole, ROLE_RANK } from '../common/roles';
import { OrganizationRole } from '../database/entities/organization-user.entity';
import {
  LeaveStatus,
  LeaveType,
} from '../database/entities/leave-request.entity';
import { LeaveService, type LeaveListQuery } from './leave.service';
import { HrService } from './hr.service';
import { StaffNotifyService } from '../integrations/staff-notify.service';

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
  constructor(
    private readonly service: LeaveService,
    /** برای فهمیدنِ «این پروندهٔ خودِ من است یا همکارم». */
    private readonly hr: HrService,
    /*
     * اعلانِ نتیجه به ربات.
     *
     * `@Optional()` است تا ماژولِ HR به ماژولِ یکپارچه‌سازی وابستهٔ سخت
     * نشود (حلقه می‌ساخت) و آزمون‌های واحد هم ساده بمانند؛ بی‌ربات،
     * تصمیم همان‌طور کار می‌کند.
     */
    @Optional()
    @Inject(forwardRef(() => StaffNotifyService))
    private readonly notify?: StaffNotifyService,
  ) {}

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

  /**
   * ثبتِ مرخصی.
   *
   * مرخصیِ **خودم** برای هر کسی که به این مسیر می‌رسد باز است؛ مرخصی به نامِ
   * **همکار** فقط از «مدیر» به بالا. پیش از این این مسیر `@MinRole` نداشت و
   * پیش‌فرضِ نگهبان (ویرایشگر برای هر تغییر) اعمال می‌شد: یک ویرایشگر — که
   * کارش فرم‌سازی است نه منابع انسانی — می‌توانست به نامِ همکارش مرخصی ثبت
   * کند.
   *
   * قاعده به‌ازای «برای چه کسی» است و نه به‌ازای مسیر، چون HR واقعاً باید
   * بتواند برای پرسنل ثبت کند و بستنِ کلِ مسیر کارِ او را می‌شکست.
   */
  @Post()
  async create(
    @OrganizationId() organizationId: string,
    @Body() dto: LeaveDto,
    @CurrentUser() user: JwtUser,
  ) {
    const mine = await this.hr.findByUser(organizationId, user.sub);
    const forSelf = Boolean(mine) && mine?.id === dto.personnelId;
    const isManager =
      ROLE_RANK[user.role ?? OrganizationRole.VIEWER] >=
      ROLE_RANK[OrganizationRole.ADMIN];

    if (!forSelf && !isManager) {
      throw new ForbiddenException(
        'ثبتِ مرخصی به نامِ همکار فقط از «مدیر» به بالا ممکن است؛ مرخصیِ خودتان را از «داشبورد من» ثبت کنید.',
      );
    }
    return this.service.create(organizationId, dto, user.sub);
  }

  /** تأیید/رد/لغو — تصمیمِ مدیر. */
  @Patch(':id/decision')
  @MinRole(OrganizationRole.ADMIN)
  async decide(
    @OrganizationId() organizationId: string,
    @Param('id') id: string,
    @Body() dto: DecisionDto,
    @CurrentUser() user: JwtUser,
  ) {
    const saved = await this.service.decide(organizationId, id, dto.status, {
      note: dto.note,
      actorId: user.sub,
    });

    /*
     * نتیجه همان لحظه به رباتِ کارمند می‌رود، نه در خلاصهٔ فردا صبح.
     *
     * بی‌انتظار (`void`) و بی‌throw: اعلان نباید مسیرِ تصمیمِ مدیر را کند
     * یا خراب کند — سرویسِ اعلان خودش خطا را می‌بلعد و لاگ می‌کند.
     */
    void this.notify?.notifyLeaveDecision({
      organizationId,
      personnelId: saved.personnelId,
      number: saved.number,
      decision: dto.status as 'approved' | 'rejected' | 'cancelled',
      fromDate: saved.fromDate,
      toDate: saved.toDate,
      note: dto.note,
    });
    return saved;
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
