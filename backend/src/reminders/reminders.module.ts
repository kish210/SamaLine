import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ResponseEntity } from '../database/entities/response.entity';
import { PublicationEntity } from '../database/entities/publication.entity';
import { FormEntity } from '../database/entities/form.entity';
import { MessagingModule } from '../messaging/messaging.module';
import { ReminderService } from './reminder.service';

/**
 * یادآوری فرم‌های نیمه‌تمام.
 *
 * روی موجودیت‌های موجود کار می‌کند (پاسخ، انتشار، فرم) و برای ارسال به
 * MessagingModule تکیه دارد؛ جدول تازه‌ای ندارد، پس مهاجرت هم لازم ندارد.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ResponseEntity, PublicationEntity, FormEntity]),
    MessagingModule,
  ],
  providers: [ReminderService],
  exports: [ReminderService],
})
export class RemindersModule {}
