import {
  IsArray,
  IsIn,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { IdentityProviderType } from '../database/entities/identity-provider.entity';
import { OrganizationRole } from '../database/entities/organization-user.entity';

/** نقش‌هایی که به کلید API داده می‌شوند؛ «مالک» عمدا نیست. */
export const API_KEY_ROLES = [
  OrganizationRole.ADMIN,
  OrganizationRole.EDITOR,
  OrganizationRole.ANALYST,
  OrganizationRole.VIEWER,
] as const;

export class CreateApiKeyDto {
  /** از توکن پر می‌شود؛ مقدار ارسالی کلاینت نادیده گرفته می‌شود. */
  @IsOptional()
  organizationId?: string;

  @IsString()
  @MaxLength(120)
  name: string;

  /** اختیار کلید؛ پیش‌فرض «بیننده» یعنی فقط خواندن. */
  @IsOptional()
  @IsIn(API_KEY_ROLES, { message: 'نقش کلید API معتبر نیست' })
  role?: OrganizationRole;

  /** انقضای اختیاری (ISO)؛ خالی یعنی بدون انقضا. */
  @IsOptional()
  @IsISO8601({}, { message: 'تاریخ انقضا معتبر نیست' })
  expiresAt?: string;

  @IsOptional()
  @IsArray()
  scopes?: string[];
}

export class CreateIdentityProviderDto {
  /** از توکن پر می‌شود؛ مقدار ارسالی کلاینت نادیده گرفته می‌شود. */
  @IsOptional()
  organizationId?: string;

  @IsIn(Object.values(IdentityProviderType))
  type: IdentityProviderType;

  @IsString()
  name: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}
