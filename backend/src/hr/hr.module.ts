import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PersonnelEntity } from '../database/entities/personnel.entity';
import { ResponseEntity } from '../database/entities/response.entity';
import { HrController } from './hr.controller';
import { HrService } from './hr.service';
import { HrStatsService } from './hr-stats.service';

/** ماژول HR: پروندهٔ پرسنل به‌عنوان داده‌ی پایه (فاز E) + گزارشِ درخواست‌ها. */
@Module({
  imports: [TypeOrmModule.forFeature([PersonnelEntity, ResponseEntity])],
  controllers: [HrController],
  providers: [HrService, HrStatsService],
  exports: [HrService],
})
export class HrModule {}
