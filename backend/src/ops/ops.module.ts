import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../database/entities/user.entity';
import { SuperAdminGuard } from '../common/super-admin.guard';
import { DailyBackupService } from './daily-backup.service';
import { HealthController } from './health.controller';
import { OpsController } from './ops.controller';
import { ServiceControlService } from './service-control.service';

/**
 * پایش و کنترل سرویس‌های سامانه.
 *
 * UserEntity برای گارد سوپرادمین لازم است (نقش را از دیتابیس می‌خواند).
 * جدول تازه‌ای ندارد؛ فقط با systemctl حرف می‌زند.
 */
@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  controllers: [OpsController, HealthController],
  providers: [ServiceControlService, SuperAdminGuard, DailyBackupService],
})
export class OpsModule {}
