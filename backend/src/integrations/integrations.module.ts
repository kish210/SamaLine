import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TenantAccessModule } from '../common/tenant-access.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhookEntity } from '../database/entities/webhook.entity';
import { FormEntity } from '../database/entities/form.entity';
import { PublicationEntity } from '../database/entities/publication.entity';
import { TelegramIntegrationEntity } from '../database/entities/telegram-integration.entity';
import { TelegramRecipientEntity } from '../database/entities/telegram-recipient.entity';
import { TelegramLinkCodeEntity } from '../database/entities/telegram-link-code.entity';
import { EmailReportRecipientEntity } from '../database/entities/email-report-recipient.entity';
import { WorkspaceEntity } from '../database/entities/workspace.entity';
import { MessagingModule } from '../messaging/messaging.module';
import { PlanModule } from '../plans/plan.module';
import { PlatformModule } from '../platform/platform.module';
import { ReportModule } from '../reports/report.module';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { TelegramApi } from './telegram-api';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';
import { TelegramBotService } from './telegram-bot.service';
import { TelegramDigestService } from './telegram-digest.service';
import { StaffBotService } from './staff-bot.service';
import { StaffNotifyService } from './staff-notify.service';
import { AnnouncementsController } from './announcements.controller';
import { AnnouncementService } from './announcement.service';
import { AnnouncementEntity } from '../database/entities/announcement.entity';
import { ResponseEntity } from '../database/entities/response.entity';
import { HrModule } from '../hr/hr.module';
import { TelegramWebhookController } from './telegram-webhook.controller';
import { WebhookDeliveryService } from './webhook-delivery.service';
import { EmailReportController } from './email-report.controller';
import { EmailReportService } from './email-report.service';

@Module({
  imports: [
    TenantAccessModule,
    PlatformModule,
    // گزارش دوره‌ای از همان تجمیعی می‌آید که پنل استفاده می‌کند.
    ReportModule,
    // وبهوک‌ها از همان صف پایدار پیام‌ها تحویل داده می‌شوند.
    MessagingModule,
    PlanModule,
    // رباتِ پرسنل (فاز F) پرونده‌ها را با موبایل وصل می‌کند.
    HrModule,
    // توکنِ هویتِ مینی‌اپ با همان رازِ سرور امضا می‌شود (payloadِ mode='bot').
    JwtModule.register({ secret: process.env.JWT_SECRET ?? 'change-me' }),
    TypeOrmModule.forFeature([
      WebhookEntity,
      TelegramIntegrationEntity,
      TelegramRecipientEntity,
      TelegramLinkCodeEntity,
      EmailReportRecipientEntity,
      WorkspaceEntity,
      FormEntity,
      AnnouncementEntity,
      // «/درخواست‌ها»ِ رباتِ پرسنل پاسخ‌های خودِ پرسنل را می‌خواند.
      ResponseEntity,
      // «📝 فرم‌ها»ِ ربات، فرم‌های منتشرشده در ربات و لینکِ انتشارشان را می‌خواند.
      PublicationEntity,
    ]),
  ],
  controllers: [
    IntegrationsController,
    TelegramController,
    TelegramWebhookController,
    EmailReportController,
    AnnouncementsController,
  ],
  providers: [
    IntegrationsService,
    TelegramApi,
    TelegramService,
    TelegramBotService,
    TelegramDigestService,
    StaffBotService,
    StaffNotifyService,
    AnnouncementService,
    EmailReportService,
    WebhookDeliveryService,
  ],
  // مسیر ثبت پاسخ عمومی هم به این سرویس نیاز دارد.
  exports: [TelegramService, WebhookDeliveryService, StaffNotifyService],
})
export class IntegrationsModule {}
