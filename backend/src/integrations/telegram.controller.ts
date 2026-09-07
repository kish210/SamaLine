import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { TelegramService } from './telegram.service';

export class TelegramSettingsDto {
  /** خالی بگذارید تا توکن ذخیره‌شده دست‌نخورده بماند. */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  botToken?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  chatId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  notifyOnResponse?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  scoreThreshold?: number | null;
}

@Controller('integrations/telegram')
@UseGuards(JwtAuthGuard)
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  @Get()
  get(@Query('workspaceId') workspaceId: string) {
    return this.telegramService.getSettings(workspaceId);
  }

  @Post()
  save(
    @Query('workspaceId') workspaceId: string,
    @Body() dto: TelegramSettingsDto,
  ) {
    return this.telegramService.saveSettings(workspaceId, dto);
  }

  @Post('test')
  test(@Query('workspaceId') workspaceId: string) {
    return this.telegramService.sendTest(workspaceId);
  }

  @Delete()
  remove(@Query('workspaceId') workspaceId: string) {
    return this.telegramService.remove(workspaceId);
  }
}
