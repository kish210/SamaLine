import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkspaceEntity } from '../database/entities/workspace.entity';
import { TelegramIntegrationEntity } from '../database/entities/telegram-integration.entity';
import { HrModule } from '../hr/hr.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { MeController } from './me.controller';
import { MeService } from './me.service';

/**
 * ماژولِ «خودم»: میزِ کارِ شخصیِ هر کاربر.
 *
 * در این فاز فقط پروندهٔ متصل و اتصالِ پیام‌رسان را دارد؛ کارها، مرخصی و
 * نامه‌ها در فازهای بعدی به همین‌جا اضافه می‌شوند. چیزی از خودش ذخیره
 * نمی‌کند و همه‌ی داده از سرویس‌های موجود می‌آید.
 */
@Module({
  imports: [
    HrModule,
    IntegrationsModule,
    TypeOrmModule.forFeature([WorkspaceEntity, TelegramIntegrationEntity]),
  ],
  controllers: [MeController],
  providers: [MeService],
  exports: [MeService],
})
export class MeModule {}
