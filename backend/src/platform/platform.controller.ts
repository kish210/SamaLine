import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, type JwtUser } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { SuperAdminGuard } from '../common/super-admin.guard';
import { PlatformSettingsService } from './platform-settings.service';
import type { PlatformSettingsEntity } from '../database/entities/platform-settings.entity';

class UpdatePlatformDto {
  @IsOptional()
  @IsBoolean()
  footerEnabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  footerText?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  footerUrl?: string;

  @IsOptional()
  @IsBoolean()
  registrationEnabled?: boolean;

  @IsOptional()
  @IsIn(['mock', 'openai'])
  aiProvider?: 'mock' | 'openai';

  @IsOptional()
  @IsString()
  @MaxLength(300)
  aiBaseUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  aiModel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  aiApiKey?: string;
}

/**
 * کلید API هرگز (حتی رمزشده) از سرور بیرون نمی‌رود؛ پنل فقط باید بداند
 * کلیدی تنظیم شده یا نه.
 */
function toSafeSettings(settings: PlatformSettingsEntity) {
  const { aiApiKey, ...rest } = settings;
  return { ...rest, aiApiKeySet: !!aiApiKey };
}

@ApiTags('platform')
@Controller('platform')
export class PlatformController {
  constructor(private readonly settings: PlatformSettingsService) {}

  /**
   * آیا کاربر جاری سوپرادمین است؟
   *
   * پنل با همین، بخش تنظیمات سکو را نشان می‌دهد یا پنهان می‌کند. پنهان
   * کردن فقط برای تجربه‌ی کاربری است؛ اعمال واقعی دسترسی با گارد است.
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() user: JwtUser) {
    return { isSuperAdmin: await this.settings.isSuperAdmin(user.sub) };
  }

  /**
   * تنظیمات عمومیِ بی‌خطر، بدون احراز هویت.
   *
   * صفحه‌ی ورود پیش از لاگین باید بداند زبانه‌ی ثبت‌نام را نشان بدهد یا نه.
   */
  @Get('public-config')
  publicConfig() {
    return this.settings.publicConfig();
  }

  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @Get('settings')
  async get() {
    return toSafeSettings(await this.settings.get());
  }

  /** نمای فراسازمانیِ سوپرادمین: شمارشِ کلِ سامانه. */
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @Get('overview')
  overview() {
    return this.settings.platformOverview();
  }

  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @Patch('settings')
  async update(@Body() dto: UpdatePlatformDto) {
    return toSafeSettings(await this.settings.update(dto));
  }

  /**
   * همه‌ی فضاهای کاری سکو، با نام سازمانشان.
   *
   * سوپرادمین باید بتواند ربات هر مجموعه را تنظیم کند؛ برای همین به فهرست
   * فرامستاجری نیاز دارد که هیچ کاربر عادی‌ای نباید ببیند.
   */
  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @Get('workspaces')
  workspaces() {
    return this.settings.allWorkspaces();
  }
}
