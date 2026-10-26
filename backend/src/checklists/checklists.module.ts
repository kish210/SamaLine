import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FormEntity } from '../database/entities/form.entity';
import { PublicationEntity } from '../database/entities/publication.entity';
import { ResponseEntity } from '../database/entities/response.entity';
import { DepartmentMemberEntity } from '../database/entities/department-member.entity';
import { UserEntity } from '../database/entities/user.entity';
import { MessagingModule } from '../messaging/messaging.module';
import { ChecklistScheduleService } from './checklist-schedule.service';

/**
 * چک‌لیست‌های موعددار و هشدارِ انجام‌نشده (فاز C).
 *
 * جدول تازه‌ای ندارد؛ حالتش در settings فرم می‌ماند و برای ارسال به
 * MessagingModule تکیه دارد.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      FormEntity,
      PublicationEntity,
      ResponseEntity,
      DepartmentMemberEntity,
      UserEntity,
    ]),
    MessagingModule,
  ],
  providers: [ChecklistScheduleService],
  exports: [ChecklistScheduleService],
})
export class ChecklistsModule {}
