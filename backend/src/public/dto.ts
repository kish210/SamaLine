import { IsObject, IsOptional, IsString } from 'class-validator';

export class SubmitResponseDto {
  @IsOptional()
  @IsString()
  respondentKey?: string;

  @IsOptional()
  @IsObject()
  meta?: Record<string, unknown>;

  @IsObject()
  answers: Record<string, unknown>;
}

export class SaveProgressDto {
  @IsOptional()
  @IsString()
  respondentKey?: string;

  @IsOptional()
  @IsObject()
  meta?: Record<string, unknown>;

  @IsObject()
  answers: Record<string, unknown>;
}
