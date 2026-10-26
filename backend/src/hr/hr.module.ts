import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PersonnelEntity } from '../database/entities/personnel.entity';
import { HrController } from './hr.controller';
import { HrService } from './hr.service';

/** ماژول HR: پروندهٔ پرسنل به‌عنوان داده‌ی پایه (فاز E). */
@Module({
  imports: [TypeOrmModule.forFeature([PersonnelEntity])],
  controllers: [HrController],
  providers: [HrService],
  exports: [HrService],
})
export class HrModule {}
