import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PersonnelEntity } from '../database/entities/personnel.entity';
import { ResponseEntity } from '../database/entities/response.entity';
import {
  LeaveBalanceEntity,
  LeaveRequestEntity,
} from '../database/entities/leave-request.entity';
import {
  AttendanceRecordEntity,
  ShiftAssignmentEntity,
  ShiftTemplateEntity,
} from '../database/entities/work-shift.entity';
import { HrController } from './hr.controller';
import { HrService } from './hr.service';
import { HrStatsService } from './hr-stats.service';
import { LeaveController } from './leave.controller';
import { LeaveService } from './leave.service';
import { ShiftController } from './shift.controller';
import { ShiftService } from './shift.service';

/**
 * ماژول HR: پروندهٔ پرسنل (فاز E) + گزارشِ درخواست‌ها + مرخصی و ماندهٔ آن.
 *
 * مرخصی موجودیتِ اختصاصی دارد، نه پاسخِ فرم؛ پس کارتابل و گزارش از ستونِ
 * واقعی خوانده می‌شوند.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      PersonnelEntity,
      ResponseEntity,
      LeaveRequestEntity,
      LeaveBalanceEntity,
      // برنامهٔ کار و حضور؛ کنارِ مرخصی می‌نشیند چون یک سوالِ عملیاتی‌اند.
      ShiftTemplateEntity,
      ShiftAssignmentEntity,
      AttendanceRecordEntity,
    ]),
  ],
  controllers: [HrController, LeaveController, ShiftController],
  providers: [HrService, HrStatsService, LeaveService, ShiftService],
  exports: [HrService, LeaveService, ShiftService],
})
export class HrModule {}
