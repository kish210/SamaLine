import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantAccessModule } from '../common/tenant-access.module';
import { DeliveryLogEntity } from '../database/entities/delivery-log.entity';
import { PublicationEntity } from '../database/entities/publication.entity';
import { PlanModule } from '../plans/plan.module';
import { DistributionController } from './distribution.controller';
import { DistributionService } from './distribution.service';

@Module({
  imports: [
    TenantAccessModule,
    TypeOrmModule.forFeature([DeliveryLogEntity, PublicationEntity]),
    PlanModule,
  ],
  controllers: [DistributionController],
  providers: [DistributionService],
})
export class DistributionModule {}
