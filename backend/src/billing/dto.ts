import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PlanCode } from '../database/entities/plan-policy.entity';

export class CreateInvoiceDto {
  @IsNotEmpty()
  organizationId: string;

  @IsInt()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class CreatePaymentDto {
  @IsNotEmpty()
  invoiceId: string;

  @IsString()
  gateway: string;

  @IsInt()
  @Min(0)
  amount: number;
}

export class VerifyPaymentDto {
  @IsIn(['success', 'failed'])
  status: 'success' | 'failed';

  @IsOptional()
  @IsString()
  referenceCode?: string;
}

export class UpdateSubscriptionDto {
  @IsNotEmpty()
  organizationId: string;

  @IsIn(Object.values(PlanCode))
  planCode: PlanCode;

  @IsOptional()
  @IsString()
  expiresAt?: string;
}

export class CreateLicenseDto {
  @IsNotEmpty()
  organizationId: string;

  @IsObject()
  capabilities: Record<string, unknown>;

  @IsOptional()
  @IsString()
  expiresAt?: string;
}

export class ValidateLicenseDto {
  @IsString()
  licenseKey: string;
}
