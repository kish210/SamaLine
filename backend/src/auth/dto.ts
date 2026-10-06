import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsNotEmpty()
  fullName: string;

  @IsEmail()
  email: string;

  @MinLength(6)
  password: string;

  @IsNotEmpty()
  organizationName: string;

  @IsNotEmpty()
  workspaceName: string;
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  password: string;

  /** کد شش‌رقمی برنامه‌ی احراز هویت؛ فقط برای حساب با ورود دومرحله‌ای. */
  @IsOptional()
  @IsString()
  @MaxLength(12)
  totpCode?: string;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @IsString()
  @MinLength(8, { message: 'رمز عبور باید دست‌کم ۸ نویسه باشد' })
  @MaxLength(128)
  newPassword: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  token: string;

  @IsString()
  @MinLength(8, { message: 'رمز عبور باید دست‌کم ۸ نویسه باشد' })
  @MaxLength(128)
  newPassword: string;
}

export class TotpCodeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(12)
  code: string;
}
