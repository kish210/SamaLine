import { IsNotEmpty, IsOptional } from 'class-validator';

export class CreateWorkspaceDto {
  /** از توکن پر می‌شود؛ مقدار ارسالی کلاینت نادیده گرفته می‌شود. */
  @IsOptional()
  organizationId?: string;

  @IsNotEmpty()
  name: string;
}
