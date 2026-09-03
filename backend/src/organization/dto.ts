import { IsArray, IsIn, IsObject, IsOptional, IsString } from 'class-validator';
import { IdentityProviderType } from '../database/entities/identity-provider.entity';

export class CreateApiKeyDto {
  /** از توکن پر می‌شود؛ مقدار ارسالی کلاینت نادیده گرفته می‌شود. */
  @IsOptional()
  organizationId?: string;

  @IsString()
  name: string;

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
