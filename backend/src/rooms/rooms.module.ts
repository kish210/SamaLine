import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HotelRoomEntity } from '../database/entities/hotel-room.entity';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';

/** اتاق‌های هتل به‌عنوان داده‌ی پایه (فاز D). */
@Module({
  imports: [TypeOrmModule.forFeature([HotelRoomEntity])],
  controllers: [RoomsController],
  providers: [RoomsService],
  exports: [RoomsService],
})
export class RoomsModule {}
