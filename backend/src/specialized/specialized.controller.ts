import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { MinRole } from '../common/roles';
import { OrganizationRole } from '../database/entities/organization-user.entity';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import {
  Evaluate360Dto,
  ExperienceMetricDto,
  QuizGradeDto,
  TemplateListQueryDto,
} from './dto';
import { SpecializedService } from './specialized.service';

@MinRole(OrganizationRole.VIEWER)
@Controller('specialized')
@UseGuards(JwtAuthGuard)
export class SpecializedController {
  constructor(private readonly specializedService: SpecializedService) {}

  @Post('quiz/grade')
  gradeQuiz(@Body() dto: QuizGradeDto) {
    return this.specializedService.gradeQuiz(dto.structure, dto.answers);
  }

  @Post('evaluation-360/aggregate')
  aggregate360(@Body() dto: Evaluate360Dto) {
    return this.specializedService.aggregate360(dto.evaluations);
  }

  @Post('experience-metrics/calculate')
  calculateMetric(@Body() dto: ExperienceMetricDto) {
    return this.specializedService.calculateExperienceMetric(
      dto.type,
      dto.scores,
    );
  }

  @Get('templates')
  listTemplates(@Query() query: TemplateListQueryDto) {
    return this.specializedService.listTemplates(query.category);
  }
}
