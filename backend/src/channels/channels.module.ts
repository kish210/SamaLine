import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantAccessModule } from '../common/tenant-access.module';
import { InterviewerQuotaEntity } from '../database/entities/interviewer-quota.entity';
import { KioskSessionEntity } from '../database/entities/kiosk-session.entity';
import { ChannelsController } from './channels.controller';
import { ChannelsService } from './channels.service';

@Module({
  imports: [
    TenantAccessModule,
    TypeOrmModule.forFeature([KioskSessionEntity, InterviewerQuotaEntity]),
  ],
  controllers: [ChannelsController],
  providers: [ChannelsService],
})
export class ChannelsModule {}
