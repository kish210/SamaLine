import {
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { OrganizationRole } from '../database/entities/organization-user.entity';
import { INVITABLE_ROLES } from './team-rules';

export class InviteMemberDto {
  @IsEmail({}, { message: 'ایمیل معتبر نیست' })
  @MaxLength(120)
  email: string;

  @IsIn(INVITABLE_ROLES, { message: 'نقش دعوت معتبر نیست' })
  role: OrganizationRole;
}

export class ChangeRoleDto {
  @IsIn(Object.values(OrganizationRole), { message: 'نقش نامعتبر است' })
  role: OrganizationRole;
}

export class AcceptInvitationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  token: string;

  /** رمز حساب موجود، یا رمز تازه برای حسابی که ساخته می‌شود. */
  @IsString()
  @IsNotEmpty({ message: 'رمز عبور لازم است' })
  @MaxLength(128)
  password: string;

  /** فقط برای ساخت حساب تازه. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(12)
  totpCode?: string;
}
