import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  Res,
  NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser, type JwtUser } from '../common/current-user.decorator';
import { TenantAccessService } from '../common/tenant-access.service';
import { ReportResponseFilterDto, SaveFilterDto } from './dto';
import { ExportService } from './export.service';
import { ReportService } from './report.service';
import { AnalyticsService } from './analytics.service';

/**
 * گزارش‌ها روی داده‌ی خام پاسخ‌دهنده‌ها کار می‌کنند، پس هر مسیر پیش از هر
 * کاری مالکیت فرم را بررسی می‌کند. شناسه‌ی فرم از درخواست می‌آید و توکن
 * چیزی درباره‌ی آن نمی‌گوید.
 */
@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportController {
  constructor(
    private readonly reportService: ReportService,
    private readonly exportService: ExportService,
    private readonly analyticsService: AnalyticsService,
    private readonly tenant: TenantAccessService,
  ) {}

  @Get('forms/:formId/summary')
  async summary(@Param('formId') formId: string, @CurrentUser() user: JwtUser) {
    await this.tenant.assertForm(formId, user);
    return this.reportService.formSummary(formId);
  }

  /**
   * تجمیع همه‌ی سوال‌ها برای گزارش تصویری فرم.
   *
   * `from` و `to` تاریخ میلادی (`YYYY-MM-DD`) و اختیاری‌اند؛ نبودنشان یعنی
   * همه‌ی پاسخ‌ها.
   */
  @Get('forms/:formId/analytics')
  async analytics(
    @Param('formId') formId: string,
    @CurrentUser() user: JwtUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    await this.tenant.assertForm(formId, user);
    return this.analyticsService.forForm(formId, { from, to });
  }

  @Get('questions/:questionId/breakdown')
  async breakdown(
    @Param('questionId') questionId: string,
    @CurrentUser() user: JwtUser,
    @Query('formId') formId?: string,
  ) {
    /*
     * `formId` اجباری است.
     *
     * بدون آن، این اندپوینت پاسخ‌های همه‌ی فرم‌های سکو را که آن شناسه‌ی
     * سوال را دارند با هم جمع می‌کند — و چون مالکیتی برای بررسی نیست،
     * راهی برای امن کردنش وجود ندارد.
     */
    if (!formId) throw new BadRequestException('formId لازم است');
    await this.tenant.assertForm(formId, user);
    return this.reportService.questionBreakdown(questionId, formId);
  }

  @Get('forms/:formId/responses')
  async filteredResponses(
    @Param('formId') formId: string,
    @Query() query: ReportResponseFilterDto,
    @CurrentUser() user: JwtUser,
  ) {
    await this.tenant.assertForm(formId, user);
    return this.reportService.filteredResponses(formId, query);
  }

  /** خروجی اکسل پاسخ‌ها؛ advanced=true متادیتا را هم می‌آورد. */
  @Get('forms/:formId/export.xlsx')
  async exportExcel(
    @Param('formId') formId: string,
    @Res() res: Response,
    @CurrentUser() user: JwtUser,
    @Query('advanced') advanced?: string,
  ) {
    await this.tenant.assertForm(formId, user);
    const buffer = await this.exportService.toExcel(
      formId,
      advanced === 'true',
    );
    res.setHeader(
      'content-type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'content-disposition',
      `attachment; filename="responses-${formId}.xlsx"`,
    );
    res.send(buffer);
  }

  @Get('forms/:formId/export.csv')
  async exportCsv(
    @Param('formId') formId: string,
    @Res() res: Response,
    @CurrentUser() user: JwtUser,
    @Query('advanced') advanced?: string,
  ) {
    await this.tenant.assertForm(formId, user);
    const csv = await this.exportService.toCsv(formId, advanced === 'true');
    res.setHeader('content-type', 'text/csv; charset=utf-8');
    res.setHeader(
      'content-disposition',
      `attachment; filename="responses-${formId}.csv"`,
    );
    res.send(csv);
  }

  @Post('filters')
  async saveFilter(@Body() dto: SaveFilterDto, @CurrentUser() user: JwtUser) {
    await this.tenant.assertWorkspace(dto.workspaceId, user);
    return this.reportService.saveFilter(dto);
  }

  @Get('filters')
  async listFilters(
    @Query('workspaceId') workspaceId: string,
    @CurrentUser() user: JwtUser,
  ) {
    await this.tenant.assertWorkspace(workspaceId, user);
    return this.reportService.listFilters(workspaceId);
  }

  @Delete('filters/:id')
  async deleteFilter(@Param('id') id: string, @CurrentUser() user: JwtUser) {
    // مالکیت از روی فضای کاریِ خودِ فیلتر بررسی می‌شود، نه از درخواست.
    const filter = await this.reportService.getFilter(id);
    if (!filter) throw new NotFoundException('فیلتر یافت نشد');
    await this.tenant.assertWorkspace(filter.workspaceId, user);
    return this.reportService.deleteFilter(id);
  }
}
