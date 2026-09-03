import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateDeliveryLogDto {
  @IsNotEmpty()
  publicationId: string;

  @IsString()
  channel: string;

  @IsIn(['queued', 'sent', 'delivered', 'failed'])
  status: 'queued' | 'sent' | 'delivered' | 'failed';

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  providerMessage?: string;
}
