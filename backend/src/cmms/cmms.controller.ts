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
  PmScheduleDto,
  RecountDto,
  RequestStatusDto,
  RoomReadinessDto,
  SparePartDto,
  StockMovementDto,
  WorkOrderDto,
  WorkOrderStatusDto,
} from './dto';
import { PmService } from './pm.service';
import { InventoryService } from './inventory.service';
import type { MovementListQuery, PartListQuery } from './inventory.service';

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
  constructor(
    private readonly cmms: CmmsService,
    private readonly pm: PmService,
    private readonly inventory: InventoryService,
  ) {}

  /**
   * داشبوردِ عملیاتیِ بخشِ فنی: سطل‌های قابلِ‌اقدام، بارِ تکنسین‌ها، فعالیتِ
   * اخیر و هزینه. هر سطل `filter` خودش را همراه دارد تا پنل بتواند همان
   * فهرست را باز کند (drill-down).
   */
  @Get('dashboard')
  @MinRole(OrganizationRole.ANALYST)
  async dashboard(
    @CurrentUser() user: JwtUser,
    @Query('departmentId') departmentId?: string,
  ) {
    /*
     * سطل‌های انبار به همان فهرستِ سطل‌ها می‌پیوندند.
     *
     * سرویسِ انبار جدا می‌ماند (CmmsService از قطعات بی‌خبر است)، ولی مدیر
     * یک داشبورد می‌بیند، نه دو تا؛ «زیرِ نقطهٔ سفارش» هم باید هم‌رده‌ی
     * «منتظرِ قطعه» دیده شود.
     */
    const [ops, inv] = await Promise.all([
      this.cmms.operationalSummary(user.organizationId, { departmentId }),
      this.inventory.summary(user.organizationId),
    ]);
    return {
      ...ops,
      buckets: [...ops.buckets, ...inv.buckets],
      inventory: { valuation: inv.valuation, consumption: inv.consumption },
    };
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

  // ── نگهداریِ پیشگیرانه ────────────────────────────────────────────────

  @Get('pm')
  @MinRole(OrganizationRole.ANALYST)
  listPm(@CurrentUser() user: JwtUser) {
    return this.pm.list(user.organizationId);
  }

  /** برنامه‌هایی که موعدشان رسیده. */
  @Get('pm/due')
  @MinRole(OrganizationRole.ANALYST)
  duePm(@CurrentUser() user: JwtUser) {
    return this.pm.due(user.organizationId);
  }

  @Post('pm')
  @MinRole(OrganizationRole.EDITOR)
  createPm(@CurrentUser() user: JwtUser, @Body() dto: PmScheduleDto) {
    return this.pm.create(user.organizationId, dto as never, user.sub);
  }

  @Patch('pm/:id')
  @MinRole(OrganizationRole.EDITOR)
  updatePm(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: Partial<PmScheduleDto>,
  ) {
    return this.pm.update(user.organizationId, id, dto as never, user.sub);
  }

  /**
   * اجرای همین‌حالای تولیدِ دستورِ کار.
   *
   * سامانه خودش ساعتی یک بار اجرا می‌کند؛ این برای وقتی است که مدیر
   * نمی‌خواهد منتظر بماند.
   */
  @Post('pm/run')
  @MinRole(OrganizationRole.ADMIN)
  runPm() {
    return this.pm.run().then((made) => ({ generated: made }));
  }

  // ── انبارِ قطعات ──────────────────────────────────────────────────────

  @Get('parts')
  @MinRole(OrganizationRole.ANALYST)
  listParts(@CurrentUser() user: JwtUser, @Query() query: PartListQuery) {
    return this.inventory.listParts(user.organizationId, query);
  }

  @Get('parts/:id')
  @MinRole(OrganizationRole.ANALYST)
  getPart(@CurrentUser() user: JwtUser, @Param('id') id: string) {
    return this.inventory.getPart(user.organizationId, id);
  }

  @Post('parts')
  @MinRole(OrganizationRole.EDITOR)
  createPart(@CurrentUser() user: JwtUser, @Body() dto: SparePartDto) {
    return this.inventory.createPart(user.organizationId, dto, user.sub);
  }

  @Patch('parts/:id')
  @MinRole(OrganizationRole.EDITOR)
  updatePart(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: Partial<SparePartDto>,
  ) {
    return this.inventory.updatePart(user.organizationId, id, dto, user.sub);
  }

  /** دفترِ گردشِ انبار. */
  @Get('stock-movements')
  @MinRole(OrganizationRole.ANALYST)
  listMovements(
    @CurrentUser() user: JwtUser,
    @Query() query: MovementListQuery,
  ) {
    return this.inventory.listMovements(user.organizationId, query);
  }

  /** ورود، مصرف، برگشت یا ضایعاتِ قطعه. */
  @Post('stock-movements')
  @MinRole(OrganizationRole.EDITOR)
  move(@CurrentUser() user: JwtUser, @Body() dto: StockMovementDto) {
    return this.inventory.move(user.organizationId, dto, user.sub);
  }

  /**
   * انبارگردانی.
   *
   * موجودیِ ثبت‌شده را با شمارشِ واقعی یکی می‌کند و اختلاف را به‌شکلِ گردشِ
   * اصلاحی در دفتر می‌گذارد. از «مدیر» به بالا، چون سندِ مالی می‌سازد.
   */
  @Post('parts/:id/recount')
  @MinRole(OrganizationRole.ADMIN)
  recount(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: RecountDto,
  ) {
    return this.inventory.recount(
      user.organizationId,
      id,
      dto.countedQuantity,
      dto.note ?? '',
      user.sub,
    );
  }

  // ── آمادگیِ اتاق ──────────────────────────────────────────────────────

  @Patch('rooms/:id/readiness')
  @MinRole(OrganizationRole.EDITOR)
  setRoomReadiness(
    @CurrentUser() user: JwtUser,
    @Param('id') id: string,
    @Body() dto: RoomReadinessDto,
  ) {
    return this.cmms.setRoomReadiness(
      user.organizationId,
      id,
      dto.readiness,
      dto.note ?? '',
      user.sub,
    );
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
