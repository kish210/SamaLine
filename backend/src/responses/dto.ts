import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ResponseFilterDto {
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

export class CreateResponseCommentDto {
  @IsNotEmpty()
  authorName: string;

  @IsNotEmpty()
  body: string;
}
