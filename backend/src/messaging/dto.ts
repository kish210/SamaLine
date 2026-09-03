import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class CampaignRecipientDto {
  /** شماره موبایل یا آدرس ایمیل گیرنده. */
  @IsNotEmpty()
  @IsString()
  to: string;

  /** متغیرهای شخصی‌سازی متن، مثل {{name}}. */
  @IsOptional()
  @IsObject()
  variables?: Record<string, unknown>;
}

export class SendCampaignDto {
  @IsNotEmpty()
  publicationId: string;

  @IsIn(['sms', 'email'])
  channel: 'sms' | 'email';

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CampaignRecipientDto)
  recipients: CampaignRecipientDto[];

  /** متن پیام؛ {{link}} با لینک یکتای هر گیرنده جایگزین می‌شود. */
  @IsNotEmpty()
  @IsString()
  template: string;

  /** موضوع — فقط برای ایمیل. */
  @IsOptional()
  @IsString()
  subject?: string;

  /** پیشوند لینک فرم؛ پیش‌فرض از PUBLIC_FORM_BASE_URL خوانده می‌شود. */
  @IsOptional()
  @IsString()
  baseUrl?: string;
}

export class SendSingleMessageDto {
  @IsIn(['sms', 'email'])
  channel: 'sms' | 'email';

  @IsNotEmpty()
  @IsString()
  recipient: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsNotEmpty()
  @IsString()
  body: string;

  @IsOptional()
  @IsString()
  publicationId?: string;
}
