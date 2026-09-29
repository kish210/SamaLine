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
import { CurrentUser, type JwtUser } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { TenantAccessService } from '../common/tenant-access.service';
import { ChannelsService } from './channels.service';
import {
  ConsumeQuotaDto,
  CreateInterviewerQuotaDto,
  StartKioskSessionDto,
  SyncKioskPayloadDto,
} from './dto';

/**
 * کیوسک و سهمیه‌ی پرسشگر.
 *
 * هر مسیر یا شناسه‌ی انتشار را مستقیم می‌گیرد یا رکوردی که به انتشار گره
 * خورده؛ در هر دو حالت مالکیت انتشار پیش از کار بررسی می‌شود.
 */
@Controller('channels')
@UseGuards(JwtAuthGuard)
export class ChannelsController {
  constructor(
    private readonly channelsService: ChannelsService,
    private readonly tenant: TenantAccessService,
  ) {}

  @Post('kiosk-sessions')
  async startKiosk(
    @Body() dto: StartKioskSessionDto,
    @CurrentUser() user: JwtUser,
  ) {
    await this.tenant.assertPublication(dto.publicationId, user);
    return this.channelsService.startKioskSession(dto);
  }

  @Patch('kiosk-sessions/:id/sync')
  async syncKiosk(
    @Param('id') id: string,
    @Body() dto: SyncKioskPayloadDto,
    @CurrentUser() user: JwtUser,
  ) {
    const publicationId = await this.channelsService.kioskPublicationId(id);
    await this.tenant.assertPublication(publicationId, user);
    return this.channelsService.syncKioskSession(id, dto);
  }

  @Get('kiosk-sessions')
  async listKiosk(
    @Query('publicationId') publicationId: string,
    @CurrentUser() user: JwtUser,
  ) {
    await this.tenant.assertPublication(publicationId, user);
    return this.channelsService.listKioskSessions(publicationId);
  }

  @Post('interviewer-quotas')
  async createQuota(
    @Body() dto: CreateInterviewerQuotaDto,
    @CurrentUser() user: JwtUser,
  ) {
    await this.tenant.assertPublication(dto.publicationId, user);
    return this.channelsService.createInterviewerQuota(dto);
  }

  @Get('interviewer-quotas')
  async listQuotas(
    @Query('publicationId') publicationId: string,
    @CurrentUser() user: JwtUser,
  ) {
    await this.tenant.assertPublication(publicationId, user);
    return this.channelsService.listInterviewerQuotas(publicationId);
  }

  @Patch('interviewer-quotas/:id/consume')
  async consumeQuota(
    @Param('id') id: string,
    @Body() dto: ConsumeQuotaDto,
    @CurrentUser() user: JwtUser,
  ) {
    const publicationId = await this.channelsService.quotaPublicationId(id);
    await this.tenant.assertPublication(publicationId, user);
    return this.channelsService.consumeQuota(id, dto);
  }
}
