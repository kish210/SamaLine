import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
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

  /** بخشِ مالکِ داشبورد؛ خالی یعنی عمومیِ سازمان. */
  @IsOptional()
  @IsString()
  departmentId?: string | null;
}

export class DashboardWidgetDto {
  @IsString()
  id: string;

  @IsIn([
    'stat',
    'bar',
    'nps',
    'text',
    'score',
    'trend',
    'table',
    'verbatim',
  ])
  type:
    | 'stat'
    | 'bar'
    | 'nps'
    | 'text'
    | 'score'
    | 'trend'
    | 'table'
    | 'verbatim';

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

  /** گامِ زمانیِ ویجتِ روند. */
  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  interval?: 'day' | 'week' | 'month';

  /** سقفِ ردیف در جدول/نظرها. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  /** جای ویجت در شبکه‌ی ۱۲ ستونی. */
  @IsObject()
  layout: { x: number; y: number; w: number; h: number };
}

export class UpdateDashboardDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  departmentId?: string | null;

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
