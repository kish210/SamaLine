import { IsObject, IsOptional } from 'class-validator';

export class SubmitResponseDto {
  @IsOptional()
  @IsObject()
  meta?: Record<string, unknown>;

  @IsObject()
  answers: Record<string, unknown>;
}
