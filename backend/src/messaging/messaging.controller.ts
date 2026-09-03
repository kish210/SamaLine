import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { CampaignService } from './campaign.service';
import { SendCampaignDto, SendSingleMessageDto } from './dto';
import { MessagingService } from './messaging.service';

@Controller('messaging')
@UseGuards(JwtAuthGuard)
export class MessagingController {
  constructor(
    private readonly messaging: MessagingService,
    private readonly campaigns: CampaignService,
  ) {}

  /** وضعیت سرویس‌دهنده‌های فعال و صف ارسال. */
  @Get('status')
  async status() {
    return {
      providers: this.messaging.activeProviders,
      queue: this.messaging.queueStats,
      durableQueue: await this.messaging.durableQueueStats(),
    };
  }

  @Post('send')
  send(@Body() dto: SendSingleMessageDto) {
    return this.messaging.send(
      {
        channel: dto.channel,
        recipient: dto.recipient,
        subject: dto.subject,
        body: dto.body,
      },
      dto.publicationId,
    );
  }

  /** ارسال گروهی دعوت‌نامه با لینک یکتا برای هر گیرنده. */
  @Post('campaigns')
  sendCampaign(@Body() dto: SendCampaignDto) {
    return this.campaigns.sendCampaign(dto);
  }

  /** گیرندگانی که هنوز پاسخ نداده‌اند — برای ارسال مجدد. */
  @Get('campaigns/:publicationId/pending')
  pending(@Param('publicationId') publicationId: string) {
    return this.campaigns.pendingRecipients(publicationId);
  }
}
