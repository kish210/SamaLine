import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CurrentUser, type JwtUser } from '../common/current-user.decorator';
import { TelegramService } from './telegram.service';
import { TelegramBotService } from './telegram-bot.service';

export class TelegramBotDto {
  /** خالی بگذارید تا توکن ذخیره‌شده دست‌نخورده بماند. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  botToken?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class TelegramRecipientDto {
  /** خالی یعنی «همه‌ی فرم‌های این فضای کاری». */
  @IsOptional()
  @IsUUID()
  formId?: string | null;

  @IsString()
  @MaxLength(64)
  chatId: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  scoreThreshold?: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class TelegramLinkCodeDto {
  /** خالی یعنی «همه‌ی فرم‌های این فضای کاری». */
  @IsOptional()
  @IsUUID()
  formId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;
}

export class TelegramRecipientPatchDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  scoreThreshold?: number | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

@Controller('integrations/telegram')
@UseGuards(JwtAuthGuard)
export class TelegramController {
  constructor(
    private readonly telegramService: TelegramService,
    private readonly botService: TelegramBotService,
  ) {}

  @Get()
  async getBot(
    @Query('workspaceId') workspaceId: string,
    @CurrentUser() user: JwtUser,
  ) {
    await this.telegramService.assertAccess(workspaceId, user);
    return this.telegramService.getBot(workspaceId);
  }

  @Post()
  async saveBot(
    @Query('workspaceId') workspaceId: string,
    @Body() dto: TelegramBotDto,
    @CurrentUser() user: JwtUser,
  ) {
    await this.telegramService.assertAccess(workspaceId, user);
    return this.telegramService.saveBot(workspaceId, dto);
  }

  @Delete()
  async removeBot(
    @Query('workspaceId') workspaceId: string,
    @CurrentUser() user: JwtUser,
  ) {
    await this.telegramService.assertAccess(workspaceId, user);
    return this.telegramService.removeBot(workspaceId);
  }

  /** گفتگوهایی که به‌تازگی به ربات پیام داده‌اند؛ برای پیدا کردن chat id. */
  @Get('chats')
  async chats(
    @Query('workspaceId') workspaceId: string,
    @CurrentUser() user: JwtUser,
  ) {
    await this.telegramService.assertAccess(workspaceId, user);
    return this.telegramService.discoverChats(workspaceId);
  }

  @Get('recipients')
  async listRecipients(
    @Query('workspaceId') workspaceId: string,
    @CurrentUser() user: JwtUser,
  ) {
    await this.telegramService.assertAccess(workspaceId, user);
    return this.telegramService.listRecipients(workspaceId);
  }

  @Post('recipients')
  async addRecipient(
    @Query('workspaceId') workspaceId: string,
    @Body() dto: TelegramRecipientDto,
    @CurrentUser() user: JwtUser,
  ) {
    await this.telegramService.assertAccess(workspaceId, user);
    return this.telegramService.addRecipient(workspaceId, dto);
  }

  @Patch('recipients/:id')
  async updateRecipient(
    @Query('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: TelegramRecipientPatchDto,
    @CurrentUser() user: JwtUser,
  ) {
    await this.telegramService.assertAccess(workspaceId, user);
    return this.telegramService.updateRecipient(workspaceId, id, dto);
  }

  @Delete('recipients/:id')
  async removeRecipient(
    @Query('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ) {
    await this.telegramService.assertAccess(workspaceId, user);
    return this.telegramService.removeRecipient(workspaceId, id);
  }

  /**
   * ساخت کد یک‌بارمصرف برای وصل کردن یک گفتگو به یک فرم.
   *
   * جایگزین پیدا کردن دستی chat id: مدیر کد را در تلگرام به ربات می‌فرستد
   * و خودش وصل می‌شود، بدون اینکه لازم باشد کسی شناسه‌ی عددی را پیدا کند.
   */
  @Post('link-code')
  async createLinkCode(
    @Query('workspaceId') workspaceId: string,
    @Body() dto: TelegramLinkCodeDto,
    @CurrentUser() user: JwtUser,
  ) {
    await this.telegramService.assertAccess(workspaceId, user);
    return this.botService.createLinkCode({
      workspaceId,
      formId: dto.formId ?? null,
      label: dto.label ?? '',
    });
  }

  @Post('recipients/:id/test')
  async test(
    @Query('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtUser,
  ) {
    await this.telegramService.assertAccess(workspaceId, user);
    return this.telegramService.sendTest(workspaceId, id);
  }
}
