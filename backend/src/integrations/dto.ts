import { IsNotEmpty, IsUrl } from 'class-validator';

export class CreateWebhookDto {
  @IsNotEmpty()
  organizationId: string;

  @IsNotEmpty()
  event: string;

  @IsUrl()
  targetUrl: string;

  @IsNotEmpty()
  secret: string;
}
