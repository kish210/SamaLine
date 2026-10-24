import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantAccessModule } from '../common/tenant-access.module';
import { MaintenanceRequestEntity } from '../database/entities/maintenance-request.entity';
import { MaintenanceEventEntity } from '../database/entities/maintenance-event.entity';
import { RoomReadinessEntity } from '../database/entities/room-readiness.entity';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceService } from './maintenance.service';

@Module({
  imports: [
    TenantAccessModule,
    TypeOrmModule.forFeature([
      MaintenanceRequestEntity,
      MaintenanceEventEntity,
      RoomReadinessEntity,
    ]),
  ],
  controllers: [MaintenanceController],
  providers: [MaintenanceService],
})
export class MaintenanceModule {}
