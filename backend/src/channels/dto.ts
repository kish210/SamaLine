import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class StartKioskSessionDto {
  @IsNotEmpty()
  publicationId: string;

  @IsString()
  deviceCode: string;
}

export class SyncKioskPayloadDto {
  @IsObject()
  payload: Record<string, unknown>;
}

export class CreateInterviewerQuotaDto {
  @IsNotEmpty()
  publicationId: string;

  @IsString()
  interviewerName: string;

  @IsInt()
  @Min(1)
  assignedQuota: number;
}

export class ConsumeQuotaDto {
  @IsInt()
  @Min(1)
  amount: number;

  @IsOptional()
  @IsBoolean()
  allowOverUsage?: boolean;
}
