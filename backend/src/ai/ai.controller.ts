import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { PlanService } from '../plans/plan.service';
import { MinRole } from '../common/roles';
import { OrganizationRole } from '../database/entities/organization-user.entity';
import { IsArray, IsIn, IsObject, IsOptional, IsString } from 'class-validator';
import { CurrentUser, type JwtUser } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { AiService } from './ai.service';

class AiCreateDto {
  @IsString()
  goal: string;

  @IsOptional()
  @IsIn(['fa', 'en', 'ar'])
  language?: 'fa' | 'en' | 'ar';
}

class AiReviewDto {
  @IsObject()
  structure: Record<string, unknown>;
}

class AiAnalyzeDto {
  @IsArray()
  @IsString({ each: true })
  answers: string[];
}

class AiChatDto {
  @IsString()
  question: string;

  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;
}

class AiMetricsDto {
  @IsObject()
  metrics: Record<string, number>;
}

class AiTranslateDto {
  @IsObject()
  structure: Record<string, unknown>;

  @IsIn(['fa', 'en', 'ar'])
  targetLanguage: 'fa' | 'en' | 'ar';
}

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly plans: PlanService,
  ) {}

  @Post('generate-form')
  async generate(@Body() dto: AiCreateDto, @CurrentUser() user: JwtUser) {
    await this.plans.assertFeature(user.organizationId, 'aiCreate');
    return this.aiService.createSurvey(dto.goal, dto.language);
  }

  @Post('review-form')
  async review(@Body() dto: AiReviewDto, @CurrentUser() user: JwtUser) {
    await this.plans.assertFeature(user.organizationId, 'aiReview');
    return this.aiService.reviewSurvey(dto.structure);
  }

  @MinRole(OrganizationRole.ANALYST)
  @Post('analyze-open-text')
  async analyze(@Body() dto: AiAnalyzeDto, @CurrentUser() user: JwtUser) {
    await this.plans.assertFeature(user.organizationId, 'aiAnalyze');
    return this.aiService.analyzeAnswers(dto.answers);
  }

  @MinRole(OrganizationRole.ANALYST)
  @Post('chat-with-data')
  async chat(@Body() dto: AiChatDto, @CurrentUser() user: JwtUser) {
    await this.plans.assertFeature(user.organizationId, 'aiAnalyze');
    return this.aiService.chatWithData(dto.question, dto.context);
  }

  @MinRole(OrganizationRole.ANALYST)
  @Post('summarize-metrics')
  async summarizeMetrics(
    @Body() dto: AiMetricsDto,
    @CurrentUser() user: JwtUser,
  ) {
    await this.plans.assertFeature(user.organizationId, 'aiAnalyze');
    return this.aiService.summarizeMetrics(dto.metrics);
  }

  @Post('translate-form')
  async translate(@Body() dto: AiTranslateDto, @CurrentUser() user: JwtUser) {
    // ترجمه‌ی فرم یعنی فرم چندزبانه؛ همان امکان پلن.
    await this.plans.assertFeature(user.organizationId, 'multiLanguage');
    return this.aiService.translateSurvey(dto.structure, dto.targetLanguage);
  }
}
