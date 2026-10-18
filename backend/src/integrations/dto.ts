import {
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { WEBHOOK_EVENTS } from './webhook-delivery.service';

export class CreateWebhookDto {
  /** از توکن پر می‌شود؛ مقدار ارسالی کلاینت نادیده گرفته می‌شود. */
  @IsOptional()
  organizationId?: string;

  @IsIn([...WEBHOOK_EVENTS])
  event: string;

  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(500)
  targetUrl: string;

  /** راز امضا؛ اگر داده نشود سرور می‌سازد. */
  @IsOptional()
  @IsString()
  @MinLength(16)
  @MaxLength(120)
  secret?: string;
}
