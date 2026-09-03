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

export class NextStepDto {
  /** صفحه‌ی فعلی؛ خالی یعنی شروع فرم. */
  @IsOptional()
  @IsString()
  currentPageId?: string;

  @IsOptional()
  @IsObject()
  answers?: Record<string, unknown>;

  /** پارامترهای مخفی لینک (utm، شعبه و …). */
  @IsOptional()
  @IsObject()
  params?: Record<string, unknown>;
}

export class LoginPasswordDto {
  @IsString()
  password: string;
}

export class RequestOtpDto {
  /** شماره موبایل یا ایمیل گیرنده‌ی کد. */
  @IsString()
  destination: string;
}

export class VerifyOtpDto {
  @IsString()
  destination: string;

  @IsString()
  code: string;
}
