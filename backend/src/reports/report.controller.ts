import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { ReportResponseFilterDto, SaveFilterDto } from './dto';
import { ReportService } from './report.service';

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

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
