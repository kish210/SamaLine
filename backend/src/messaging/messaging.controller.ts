import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, type JwtUser } from '../common/current-user.decorator';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { TenantAccessService } from '../common/tenant-access.service';
import { PlanService } from '../plans/plan.service';
import { CampaignService } from './campaign.service';
import { SendCampaignDto, SendSingleMessageDto } from './dto';
import { MessagingService } from './messaging.service';

@Controller('messaging')
@UseGuards(JwtAuthGuard)
export class MessagingController {
  constructor(
    private readonly messaging: MessagingService,
    private readonly campaigns: CampaignService,
    private readonly tenant: TenantAccessService,
    private readonly plans: PlanService,
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
  async send(@Body() dto: SendSingleMessageDto, @CurrentUser() user: JwtUser) {
    if (dto.publicationId) {
      await this.tenant.assertPublication(dto.publicationId, user);
    }
    await this.assertChannelInPlan(dto.channel, user);
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
  async sendCampaign(
    @Body() dto: SendCampaignDto,
    @CurrentUser() user: JwtUser,
  ) {
    // بدون این، هر کاربری می‌توانست به نام فرم سازمان دیگری پیام بفرستد.
    await this.tenant.assertPublication(dto.publicationId, user);
    await this.assertChannelInPlan(dto.channel, user);
    return this.campaigns.sendCampaign(dto);
  }

  /**
   * پنل پیامکی و پنل ایمیلی امکانات پلن‌اند.
   *
   * ایمیل بازیابی رمز و دعوت تیم از این مسیر نمی‌روند، پس پلن رایگان همچنان
   * آن‌ها را می‌گیرد؛ اینجا فقط ارسال دستی و کمپین کاربر است.
   */
  private assertChannelInPlan(channel: string, user: JwtUser) {
    const feature = channel === 'sms' ? 'smsPanel' : 'emailPanel';
    return this.plans.assertFeature(user.organizationId, feature);
  }

  /** گیرندگانی که هنوز پاسخ نداده‌اند — برای ارسال مجدد. */
  @Get('campaigns/:publicationId/pending')
  async pending(
    @Param('publicationId') publicationId: string,
    @CurrentUser() user: JwtUser,
  ) {
    // فهرست گیرندگان داده‌ی شخصی است (شماره و ایمیل).
    await this.tenant.assertPublication(publicationId, user);
    return this.campaigns.pendingRecipients(publicationId);
  }
}
