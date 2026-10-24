import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantAccessModule } from '../common/tenant-access.module';
import { ColdRoomSensorEntity } from '../database/entities/cold-room-sensor.entity';
import { SensorReadingEntity } from '../database/entities/sensor-reading.entity';
import { SensorAlertEntity } from '../database/entities/sensor-alert.entity';
import { SensorsController } from './sensors.controller';
import { SensorsService } from './sensors.service';

@Module({
  imports: [
    TenantAccessModule,
    TypeOrmModule.forFeature([
      ColdRoomSensorEntity,
      SensorReadingEntity,
      SensorAlertEntity,
    ]),
  ],
  controllers: [SensorsController],
  providers: [SensorsService],
})
export class SensorsModule {}
