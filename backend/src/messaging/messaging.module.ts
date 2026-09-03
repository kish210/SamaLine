import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeliveryLogEntity } from '../database/entities/delivery-log.entity';
import { PublicationEntity } from '../database/entities/publication.entity';
import { ResponseEntity } from '../database/entities/response.entity';
import { FormModule } from '../forms/form.module';
import { CampaignService } from './campaign.service';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DeliveryLogEntity,
      PublicationEntity,
      ResponseEntity,
    ]),
    FormModule,
  ],
  providers: [MessagingService, CampaignService],
  controllers: [MessagingController],
  exports: [MessagingService, CampaignService],
})
export class MessagingModule {}
