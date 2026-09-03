import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { IsArray, IsIn, IsObject, IsOptional, IsString } from 'class-validator';
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
  constructor(private readonly aiService: AiService) {}

  @Post('generate-form')
  generate(@Body() dto: AiCreateDto) {
    return this.aiService.createSurvey(dto.goal, dto.language);
  }

  @Post('review-form')
  review(@Body() dto: AiReviewDto) {
    return this.aiService.reviewSurvey(dto.structure);
  }

  @Post('analyze-open-text')
  analyze(@Body() dto: AiAnalyzeDto) {
    return this.aiService.analyzeAnswers(dto.answers);
  }

  @Post('chat-with-data')
  chat(@Body() dto: AiChatDto) {
    return this.aiService.chatWithData(dto.question, dto.context);
  }

  @Post('summarize-metrics')
  summarizeMetrics(@Body() dto: AiMetricsDto) {
    return this.aiService.summarizeMetrics(dto.metrics);
  }

  @Post('translate-form')
  translate(@Body() dto: AiTranslateDto) {
    return this.aiService.translateSurvey(dto.structure, dto.targetLanguage);
  }
}
