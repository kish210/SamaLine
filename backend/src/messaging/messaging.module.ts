import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeliveryLogEntity } from '../database/entities/delivery-log.entity';
import { PublicationEntity } from '../database/entities/publication.entity';
import { QueuedJobEntity } from '../database/entities/queued-job.entity';
import { ResponseEntity } from '../database/entities/response.entity';
import { TenantAccessModule } from '../common/tenant-access.module';
import { FormModule } from '../forms/form.module';
import { CampaignService } from './campaign.service';
import { DurableQueueService } from './durable-queue.service';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';

@Module({
  imports: [
    TenantAccessModule,
    TypeOrmModule.forFeature([
      DeliveryLogEntity,
      PublicationEntity,
      ResponseEntity,
      QueuedJobEntity,
    ]),
    FormModule,
  ],
  providers: [MessagingService, CampaignService, DurableQueueService],
  controllers: [MessagingController],
  exports: [MessagingService, CampaignService, DurableQueueService],
})
export class MessagingModule {}
