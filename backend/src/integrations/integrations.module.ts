import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WebhookEntity } from '../database/entities/webhook.entity';
import { TelegramIntegrationEntity } from '../database/entities/telegram-integration.entity';
import { TelegramRecipientEntity } from '../database/entities/telegram-recipient.entity';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { TelegramController } from './telegram.controller';
import { TelegramService } from './telegram.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WebhookEntity,
      TelegramIntegrationEntity,
      TelegramRecipientEntity,
    ]),
  ],
  controllers: [IntegrationsController, TelegramController],
  providers: [IntegrationsService, TelegramService],
  // مسیر ثبت پاسخ عمومی هم به این سرویس نیاز دارد.
  exports: [TelegramService],
})
export class IntegrationsModule {}
