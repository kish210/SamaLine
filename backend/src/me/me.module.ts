import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkspaceEntity } from '../database/entities/workspace.entity';
import { TelegramIntegrationEntity } from '../database/entities/telegram-integration.entity';
import { HrModule } from '../hr/hr.module';
import { CmmsModule } from '../cmms/cmms.module';
import { LetterModule } from '../letters/letter.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { MeController } from './me.controller';
import { MeService } from './me.service';
import { DeskService } from './desk.service';

/**
 * ماژولِ «خودم»: میزِ کارِ شخصیِ هر کاربر.
 *
 * کارها، درخواست‌ها، مرخصی، شیفت، حضور، نامه و اطلاعیه‌های هر کاربر را در
 * یک فراخوانی می‌دهد. چیزی از خودش ذخیره نمی‌کند و همهٔ داده از
 * سرویس‌های موجود می‌آید.
 */
@Module({
  imports: [
    HrModule,
    /*
     * میزِ کار از همان سرویس‌هایی می‌خواند که صفحه‌های اختصاصی استفاده
     * می‌کنند، پس عددِ میزِ کار و عددِ صفحهٔ مقصد از هم جدا نمی‌افتند.
     */
    CmmsModule,
    LetterModule,
    IntegrationsModule,
    TypeOrmModule.forFeature([WorkspaceEntity, TelegramIntegrationEntity]),
  ],
  controllers: [MeController],
  providers: [MeService, DeskService],
  exports: [MeService, DeskService],
})
export class MeModule {}
