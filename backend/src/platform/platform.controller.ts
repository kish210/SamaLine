import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, type JwtUser } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { SuperAdminGuard } from '../common/super-admin.guard';
import { PlatformSettingsService } from './platform-settings.service';

class UpdateFooterDto {
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

  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @Get('settings')
  get() {
    return this.settings.get();
  }

  @UseGuards(JwtAuthGuard, SuperAdminGuard)
  @Patch('settings')
  update(@Body() dto: UpdateFooterDto) {
    return this.settings.update(dto);
  }
}
