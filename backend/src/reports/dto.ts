import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class SaveFilterDto {
  @IsNotEmpty()
  workspaceId: string;

  @IsString()
  name: string;

  @IsObject()
  definition: Record<string, unknown>;
}

export class ReportResponseFilterDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  respondentKey?: string;

  @IsOptional()
  @IsString()
  questionId?: string;

  @IsOptional()
  @IsString()
  valueText?: string;

  @IsOptional()
  @IsString()
  dateFrom?: string;

  @IsOptional()
  @IsString()
  dateTo?: string;
}

export class CreateDashboardDto {
  @IsNotEmpty()
  @IsString()
  name: string;
}

export class DashboardWidgetDto {
  @IsString()
  id: string;

  @IsIn(['stat', 'bar', 'nps', 'text', 'score'])
  type: 'stat' | 'bar' | 'nps' | 'text' | 'score';

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  formId?: string;

  @IsOptional()
  @IsString()
  questionId?: string;

  @IsOptional()
  @IsString()
  metric?: string;

  @IsOptional()
  @IsString()
  scoreKey?: string;

  @IsOptional()
  @IsString()
  content?: string;

  /** جای ویجت در شبکه‌ی ۱۲ ستونی. */
  @IsObject()
  layout: { x: number; y: number; w: number; h: number };
}

export class UpdateDashboardDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DashboardWidgetDto)
  widgets?: DashboardWidgetDto[];
}

export class SetDashboardPublicDto {
  @IsBoolean()
  isPublic: boolean;
}
