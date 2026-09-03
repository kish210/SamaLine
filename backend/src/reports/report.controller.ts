import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
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
}
