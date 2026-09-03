import {
  IsArray,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { IdentityProviderType } from '../database/entities/identity-provider.entity';

export class CreateApiKeyDto {
  @IsNotEmpty()
  organizationId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsArray()
  scopes?: string[];
}

export class CreateIdentityProviderDto {
  @IsNotEmpty()
  organizationId: string;

  @IsIn(Object.values(IdentityProviderType))
  type: IdentityProviderType;

  @IsString()
  name: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}
