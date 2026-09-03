import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

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
