import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { ReportResponseFilterDto, SaveFilterDto } from './dto';
import { ExportService } from './export.service';
import { ReportService } from './report.service';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportController {
  constructor(
    private readonly reportService: ReportService,
    private readonly exportService: ExportService,
  ) {}

  @Get('forms/:formId/summary')
  summary(@Param('formId') formId: string) {
    return this.reportService.formSummary(formId);
  }

  @Get('questions/:questionId/breakdown')
  breakdown(@Param('questionId') questionId: string) {
    return this.reportService.questionBreakdown(questionId);
  }

  @Get('forms/:formId/responses')
  filteredResponses(
    @Param('formId') formId: string,
    @Query() query: ReportResponseFilterDto,
  ) {
    return this.reportService.filteredResponses(formId, query);
  }

  /** خروجی اکسل پاسخ‌ها؛ advanced=true متادیتا را هم می‌آورد. */
  @Get('forms/:formId/export.xlsx')
  async exportExcel(
    @Param('formId') formId: string,
    @Res() res: Response,
    @Query('advanced') advanced?: string,
  ) {
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
    @Query('advanced') advanced?: string,
  ) {
    const csv = await this.exportService.toCsv(formId, advanced === 'true');
    res.setHeader('content-type', 'text/csv; charset=utf-8');
    res.setHeader(
      'content-disposition',
      `attachment; filename="responses-${formId}.csv"`,
    );
    res.send(csv);
  }

  @Post('filters')
  saveFilter(@Body() dto: SaveFilterDto) {
    return this.reportService.saveFilter(dto);
  }

  @Get('filters')
  listFilters(@Query('workspaceId') workspaceId: string) {
    return this.reportService.listFilters(workspaceId);
  }

  @Delete('filters/:id')
  deleteFilter(@Param('id') id: string) {
    return this.reportService.deleteFilter(id);
  }
}
