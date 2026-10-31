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
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser, type JwtUser } from '../common/current-user.decorator';
import { MinRole } from '../common/roles';
import { OrganizationRole } from '../database/entities/organization-user.entity';
import { CmmsService } from './cmms.service';
import type { ListQuery } from './cmms.service';
import {
  AssetDto,
  MaintenanceRequestDto,
  RequestStatusDto,
  WorkOrderDto,
  WorkOrderStatusDto,
} from './dto';

/**
 * APIهای دامنهٔ فنی (CMMS).
 *
 * `organizationId` همیشه از توکن خوانده می‌شود، نه از کوئری یا بدنه؛ پس یک
 * سازمان نمی‌تواند رکوردِ سازمانِ دیگر را ببیند یا عوض کند. خواندن برای
 * «تحلیل‌گر» به بالا باز است و نوشتن از «ویرایشگر» به بالا (پیش‌فرضِ امنِ
 * پروژه)، مگر جایی که صریح بالاتر رفته باشد.
 */
@Controller('cmms')
@UseGuards(JwtAuthGuard)
export class CmmsController {
  constructor(private readonly cmms: CmmsService) {}

  /**
   * داشبوردِ عملیاتیِ بخشِ فنی: سطل‌های قابلِ‌اقدام، بارِ تکنسین‌ها، فعالیتِ
   * اخیر و هزینه. هر سطل `filter` خودش را همراه دارد تا پنل بتواند همان
   * فهرست را باز کند (drill-down).
   */
  @Get('dashboard')
  @MinRole(OrganizationRole.ANALYST)
  dashboard(
    @CurrentUser() user: JwtUser,
    @Query('departmentId') departmentId?: string,
  ) {
    return this.cmms.operationalSummary(user.organizationId, { departmentId });
  }

  // ── دارایی ────────────────────────────────────────────────────────────

  @Get('assets')
  @MinRole(OrganizationRole.ANALYST)
  listAssets(@CurrentUser() user: JwtUser, @Query() query: ListQuery) {
    return this.cmms.listAssets(user.organizationId, query);
  }

  @Get('assets/:id')
  @MinRole(OrganizationRole.ANALYST)
  getAsset(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.cmms.getAsset(user.organizationId, id);
  }

  @Post('assets')
  @MinRole(OrganizationRole.EDITOR)
  createAsset(@CurrentUser() user: JwtUser, @Body() dto: AssetDto) {
    return this.cmms.createAsset(user.organizationId, dto, user.sub);
  }

  @Patch('assets/:id')
  @MinRole(OrganizationRole.EDITOR)
  updateAsset(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: Partial<AssetDto>,
  ) {
    return this.cmms.updateAsset(user.organizationId, id, dto, user.sub);
  }

  // ── درخواستِ تعمیر ────────────────────────────────────────────────────

  @Get('requests')
  @MinRole(OrganizationRole.ANALYST)
  listRequests(@CurrentUser() user: JwtUser, @Query() query: ListQuery) {
    return this.cmms.listRequests(user.organizationId, query);
  }

  @Get('requests/:id')
  @MinRole(OrganizationRole.ANALYST)
  getRequest(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.cmms.getRequest(user.organizationId, id);
  }

  /** ثبتِ درخواست برای هر کاربرِ واردشده باز است؛ خرابی را هر کسی می‌بیند. */
  @Post('requests')
  @MinRole(OrganizationRole.VIEWER)
  createRequest(
    @CurrentUser() user: JwtUser,
    @Body() dto: MaintenanceRequestDto,
  ) {
    return this.cmms.createRequest(
      user.organizationId,
      { ...dto, requestedByUserId: user.sub },
      user.sub,
    );
  }

  @Patch('requests/:id/status')
  @MinRole(OrganizationRole.EDITOR)
  changeRequestStatus(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: RequestStatusDto,
  ) {
    return this.cmms.changeRequestStatus(user.organizationId, id, dto.status, {
      note: dto.note,
      actorId: user.sub,
    });
  }

  // ── دستورِ کار ────────────────────────────────────────────────────────

  @Get('work-orders')
  @MinRole(OrganizationRole.ANALYST)
  listWorkOrders(@CurrentUser() user: JwtUser, @Query() query: ListQuery) {
    return this.cmms.listWorkOrders(user.organizationId, query);
  }

  @Get('work-orders/:id')
  @MinRole(OrganizationRole.ANALYST)
  getWorkOrder(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.cmms.getWorkOrder(user.organizationId, id);
  }

  @Post('work-orders')
  @MinRole(OrganizationRole.EDITOR)
  createWorkOrder(@CurrentUser() user: JwtUser, @Body() dto: WorkOrderDto) {
    return this.cmms.createWorkOrder(user.organizationId, dto, user.sub);
  }

  @Patch('work-orders/:id/status')
  @MinRole(OrganizationRole.EDITOR)
  changeWorkOrderStatus(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: WorkOrderStatusDto,
  ) {
    return this.cmms.changeWorkOrderStatus(
      user.organizationId,
      id,
      dto.status,
      { note: dto.note, actorId: user.sub },
    );
  }
}
