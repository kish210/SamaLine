import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { MinRole } from '../common/roles';
import { OrganizationRole } from '../database/entities/organization-user.entity';
import { CurrentUser, type JwtUser } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { AuthService } from './auth.service';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
  SwitchOrganizationDto,
  TotpCodeDto,
} from './dto';
import { PasswordService } from './password.service';
import { TwoFactorService } from './two-factor.service';

@MinRole(OrganizationRole.VIEWER)
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly twoFactor: TwoFactorService,
    private readonly passwords: PasswordService,
  ) {}

  /**
   * تغییر رمز. همه‌ی نشست‌های دیگر باطل می‌شوند و نشست تازه برای همین
   * دستگاه برمی‌گردد.
   */
  @UseGuards(JwtAuthGuard)
  @Post('password')
  async changePassword(
    @CurrentUser() user: JwtUser,
    @Body() dto: ChangePasswordDto,
  ) {
    const updated = await this.passwords.change(
      user.sub,
      dto.currentPassword,
      dto.newPassword,
    );
    return this.authService.sessionFor(updated, user.organizationId);
  }

  /** درخواست لینک بازیابی؛ پاسخ برای هر ایمیلی یکسان است. */
  @Post('password/forgot')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    /*
     * نشانی لینک فقط از PUBLIC_URL ساخته می‌شود، نه از سربرگ Host درخواست؛
     * وگرنه مهاجم می‌توانست لینکی به دامنه‌ی خودش در ایمیل قربانی بگذارد.
     */
    const base = process.env.PUBLIC_URL || 'http://localhost:5174';
    return this.passwords.requestReset(dto.email, base);
  }

  @Post('password/reset')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.passwords.resetWithToken(dto.token, dto.newPassword);
  }

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /**
   * ورود. برای حسابی با ورود دومرحله‌ای، بدون `totpCode` پاسخ
   * `{ twoFactorRequired: true }` است و توکنی صادر نمی‌شود.
   */
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /** حساب جاری، نقش در سازمان فعلی و فهرست سازمان‌های کاربر. */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: JwtUser) {
    return this.authService.me(user.sub, user.organizationId);
  }

  /** رفتن به سازمان دیگری که کاربر عضوش است. */
  @UseGuards(JwtAuthGuard)
  @Post('switch-organization')
  switchOrganization(
    @CurrentUser() user: JwtUser,
    @Body() dto: SwitchOrganizationDto,
  ) {
    return this.authService.switchOrganization(user.sub, dto.organizationId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('2fa')
  twoFactorStatus(@CurrentUser() user: JwtUser) {
    return this.twoFactor.status(user.sub);
  }

  /** کلید تازه و نشانی otpauth برای اسکن QR. */
  @UseGuards(JwtAuthGuard)
  @Post('2fa/setup')
  twoFactorSetup(@CurrentUser() user: JwtUser) {
    return this.twoFactor.setup(user.sub);
  }

  /** روشن کردن با اولین کد درست. */
  @UseGuards(JwtAuthGuard)
  @Post('2fa/enable')
  twoFactorEnable(@CurrentUser() user: JwtUser, @Body() dto: TotpCodeDto) {
    return this.twoFactor.enable(user.sub, dto.code);
  }

  /** خاموش کردن؛ کد جاری لازم است تا توکن دزدیده‌شده نتواند خاموشش کند. */
  @UseGuards(JwtAuthGuard)
  @Post('2fa/disable')
  twoFactorDisable(@CurrentUser() user: JwtUser, @Body() dto: TotpCodeDto) {
    return this.twoFactor.disable(user.sub, dto.code);
  }
}
