import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { LeaveType } from '../database/entities/leave-request.entity';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser, type JwtUser } from '../common/current-user.decorator';
import { MeService } from './me.service';
import { DeskService } from './desk.service';

/**
 * درخواستِ مرخصیِ خودسرویس.
 *
 * عمداً `personnelId` ندارد: هر چه کلاینت بفرستد نادیده گرفته می‌شود و
 * پرونده از توکن می‌آید، پس کسی نمی‌تواند به نامِ همکارش مرخصی ثبت کند.
 */
class MyLeaveDto {
  @IsNotEmpty() @IsString() @MaxLength(10) fromDate: string;
  @IsNotEmpty() @IsString() @MaxLength(10) toDate: string;

  @IsOptional() @IsIn(Object.values(LeaveType)) type?: LeaveType;
  @IsOptional() @IsString() @MaxLength(500) reason?: string;
  @IsOptional() @IsInt() @Min(1) days?: number;
}

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
  constructor(
    private readonly me: MeService,
    private readonly desk: DeskService,
  ) {}

  /** میزِ کارِ شخصی: کارها، درخواست‌ها، مرخصی، شیفت، حضور، نامه، اطلاعیه. */
  @Get('desk')
  deskOf(@CurrentUser() user: JwtUser) {
    return this.desk.desk(user.organizationId, user.sub);
  }

  /**
   * ثبتِ مرخصیِ خودم.
   *
   * مسیرِ مدیریتیِ `POST /hr/leaves` دست‌نخورده می‌ماند (HR به‌نامِ دیگران
   * ثبت می‌کند)؛ این یکی فقط برای خودِ کاربر است و پرونده را از توکن
   * می‌گیرد.
   */
  @Post('leaves')
  requestLeave(@CurrentUser() user: JwtUser, @Body() dto: MyLeaveDto) {
    return this.me.requestLeave(user.organizationId, user.sub, dto);
  }

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
