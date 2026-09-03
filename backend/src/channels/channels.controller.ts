import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { ChannelsService } from './channels.service';
import {
  ConsumeQuotaDto,
  CreateInterviewerQuotaDto,
  StartKioskSessionDto,
  SyncKioskPayloadDto,
} from './dto';

@Controller('channels')
@UseGuards(JwtAuthGuard)
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  @Post('kiosk-sessions')
  startKiosk(@Body() dto: StartKioskSessionDto) {
    return this.channelsService.startKioskSession(dto);
  }

  @Patch('kiosk-sessions/:id/sync')
  syncKiosk(@Param('id') id: string, @Body() dto: SyncKioskPayloadDto) {
    return this.channelsService.syncKioskSession(id, dto);
  }

  @Get('kiosk-sessions')
  listKiosk(@Query('publicationId') publicationId: string) {
    return this.channelsService.listKioskSessions(publicationId);
  }

  @Post('interviewer-quotas')
  createQuota(@Body() dto: CreateInterviewerQuotaDto) {
    return this.channelsService.createInterviewerQuota(dto);
  }

  @Get('interviewer-quotas')
  listQuotas(@Query('publicationId') publicationId: string) {
    return this.channelsService.listInterviewerQuotas(publicationId);
  }

  @Patch('interviewer-quotas/:id/consume')
  consumeQuota(@Param('id') id: string, @Body() dto: ConsumeQuotaDto) {
    return this.channelsService.consumeQuota(id, dto);
  }
}
