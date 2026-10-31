import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HotelRoomEntity } from '../database/entities/hotel-room.entity';
import { CmmsModule } from '../cmms/cmms.module';
import { HrModule } from '../hr/hr.module';
import { CommandCenterController } from './command-center.controller';
import { CommandCenterService } from './command-center.service';

/**
 * میزِ فرماندهیِ مدیریت.
 *
 * ماژولِ نازکی است که فقط تجمیع می‌کند: هیچ جدول یا قاعده‌ی تازه‌ای ندارد و
 * همه‌ی عددها از سرویس‌های موجود (CMMS، انبار، شیفت، مرخصی) می‌آیند. برای
 * همین عددِ داشبورد و عددِ صفحهٔ مقصد نمی‌توانند از هم جدا بیفتند.
 */
@Module({
  imports: [CmmsModule, HrModule, TypeOrmModule.forFeature([HotelRoomEntity])],
  controllers: [CommandCenterController],
  providers: [CommandCenterService],
  exports: [CommandCenterService],
})
export class CommandCenterModule {}
