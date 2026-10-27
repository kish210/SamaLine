import { Module } from '@nestjs/common';
import { TenantAccessModule } from '../common/tenant-access.module';
import { DepartmentsModule } from '../departments/departments.module';
import { FormModule } from '../forms/form.module';
import { ReportModule } from '../reports/report.module';
import { HotelSetupController } from './hotel-setup.controller';
import { HotelSetupService } from './hotel-setup.service';

/** راه‌اندازیِ یک‌کلیکیِ واحدهای هتل (بخش + فرمِ عملیاتی + داشبورد). */
@Module({
  imports: [TenantAccessModule, DepartmentsModule, FormModule, ReportModule],
  controllers: [HotelSetupController],
  providers: [HotelSetupService],
})
export class HotelSetupModule {}
