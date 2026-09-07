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
import { TelegramService } from './telegram.service';

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
  constructor(private readonly telegramService: TelegramService) {}

  @Get()
  getBot(@Query('workspaceId') workspaceId: string) {
    return this.telegramService.getBot(workspaceId);
  }

  @Post()
  saveBot(
    @Query('workspaceId') workspaceId: string,
    @Body() dto: TelegramBotDto,
  ) {
    return this.telegramService.saveBot(workspaceId, dto);
  }

  @Delete()
  removeBot(@Query('workspaceId') workspaceId: string) {
    return this.telegramService.removeBot(workspaceId);
  }

  /** گفتگوهایی که به‌تازگی به ربات پیام داده‌اند؛ برای پیدا کردن chat id. */
  @Get('chats')
  chats(@Query('workspaceId') workspaceId: string) {
    return this.telegramService.discoverChats(workspaceId);
  }

  @Get('recipients')
  listRecipients(@Query('workspaceId') workspaceId: string) {
    return this.telegramService.listRecipients(workspaceId);
  }

  @Post('recipients')
  addRecipient(
    @Query('workspaceId') workspaceId: string,
    @Body() dto: TelegramRecipientDto,
  ) {
    return this.telegramService.addRecipient(workspaceId, dto);
  }

  @Patch('recipients/:id')
  updateRecipient(
    @Query('workspaceId') workspaceId: string,
    @Param('id') id: string,
    @Body() dto: TelegramRecipientPatchDto,
  ) {
    return this.telegramService.updateRecipient(workspaceId, id, dto);
  }

  @Delete('recipients/:id')
  removeRecipient(
    @Query('workspaceId') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.telegramService.removeRecipient(workspaceId, id);
  }

  @Post('recipients/:id/test')
  test(
    @Query('workspaceId') workspaceId: string,
    @Param('id') id: string,
  ) {
    return this.telegramService.sendTest(workspaceId, id);
  }
}
