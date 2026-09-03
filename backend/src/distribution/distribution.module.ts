import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeliveryLogEntity } from '../database/entities/delivery-log.entity';
import { PublicationEntity } from '../database/entities/publication.entity';
import { DistributionController } from './distribution.controller';
import { DistributionService } from './distribution.service';

@Module({
  imports: [TypeOrmModule.forFeature([DeliveryLogEntity, PublicationEntity])],
  controllers: [DistributionController],
  providers: [DistributionService],
})
export class DistributionModule {}
