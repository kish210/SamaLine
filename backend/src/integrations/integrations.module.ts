import { Module } from '@nestjs/common';
import { TenantAccessModule } from '../common/tenant-access.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhookEntity } from '../database/entities/webhook.entity';
import { FormEntity } from '../database/entities/form.entity';
import { TelegramIntegrationEntity } from '../database/entities/telegram-integration.entity';
import { TelegramRecipientEntity } from '../database/entities/telegram-recipient.entity';
import { TelegramLinkCodeEntity } from '../database/entities/telegram-link-code.entity';
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
import { TelegramWebhookController } from './telegram-webhook.controller';
import { WebhookDeliveryService } from './webhook-delivery.service';

@Module({
  imports: [
    TenantAccessModule,
    PlatformModule,
    // گزارش دوره‌ای از همان تجمیعی می‌آید که پنل استفاده می‌کند.
    ReportModule,
    // وبهوک‌ها از همان صف پایدار پیام‌ها تحویل داده می‌شوند.
    MessagingModule,
    PlanModule,
    TypeOrmModule.forFeature([
      WebhookEntity,
      TelegramIntegrationEntity,
      TelegramRecipientEntity,
      TelegramLinkCodeEntity,
      WorkspaceEntity,
      FormEntity,
    ]),
  ],
  controllers: [
    IntegrationsController,
    TelegramController,
    TelegramWebhookController,
  ],
  providers: [
    IntegrationsService,
    TelegramApi,
    TelegramService,
    TelegramBotService,
    TelegramDigestService,
    WebhookDeliveryService,
  ],
  // مسیر ثبت پاسخ عمومی هم به این سرویس نیاز دارد.
  exports: [TelegramService, WebhookDeliveryService],
})
export class IntegrationsModule {}
