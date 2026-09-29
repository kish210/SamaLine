import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, type JwtUser } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, TotpCodeDto } from './dto';
import { TwoFactorService } from './two-factor.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly twoFactor: TwoFactorService,
  ) {}

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
