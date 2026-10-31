import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssetEntity } from '../database/entities/asset.entity';
import { MaintenanceRequestEntity } from '../database/entities/maintenance-request.entity';
import {
  WorkOrderEntity,
  WorkOrderTechnicianEntity,
} from '../database/entities/work-order.entity';
import { PersonnelEntity } from '../database/entities/personnel.entity';
import { CmmsController } from './cmms.controller';
import { CmmsService } from './cmms.service';

/**
 * دامنهٔ نگهداری و تعمیرات (CMMS).
 *
 * ماژولِ مستقل است و چیزی از ماژول‌های موجود را تغییر نمی‌دهد؛ فقط از
 * زیرساختِ مشترک (نگهبانِ JWT، نقش‌ها، ممیزی) استفاده می‌کند. `AuditService`
 * سراسری است و با `@Optional()` تزریق می‌شود تا تست‌های واحد ساده بمانند.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      AssetEntity,
      MaintenanceRequestEntity,
      WorkOrderEntity,
      WorkOrderTechnicianEntity,
      // فقط برای نشان‌دادنِ نامِ تکنسین در بارِ کاری؛ دفترچهٔ پرسنل مالِ HR است.
      PersonnelEntity,
    ]),
  ],
  controllers: [CmmsController],
  providers: [CmmsService],
  exports: [CmmsService],
})
export class CmmsModule {}
