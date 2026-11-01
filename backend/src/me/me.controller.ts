import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser, type JwtUser } from '../common/current-user.decorator';
import { MeService } from './me.service';

/**
 * APIهای «خودم».
 *
 * هیچ `@MinRole` ندارد و فقط `JwtAuthGuard`: این مسیرها دادهٔ خودِ کاربر
 * واردشده را می‌دهند، پس هر نقشی — حتی «بیننده» — باید به آن‌ها دسترسی
 * داشته باشد. هویت از توکن خوانده می‌شود، نه از پارامتر؛ پس هیچ‌کس نمی‌تواند
 * با عوض کردنِ ورودی، دادهٔ شخصِ دیگری را بگیرد.
 */
@Controller('me')
@UseGuards(JwtAuthGuard)
export class MeController {
  constructor(private readonly me: MeService) {}

  @Get('profile')
  profile(@CurrentUser() user: JwtUser) {
    return this.me.profile(user.organizationId, user.sub);
  }

  /** کدِ یک‌بارمصرف برای وصل کردنِ بله/تلگرام به پروندهٔ خودم. */
  @Post('bot-links/code')
  createCode(@CurrentUser() user: JwtUser) {
    return this.me.createBotLinkCode(user.organizationId, user.sub);
  }

  @Delete('bot-links/:platform')
  removeLink(
    @CurrentUser() user: JwtUser,
    @Param('platform') platform: string,
  ) {
    return this.me.removeBotLink(user.organizationId, user.sub, platform);
  }
}
