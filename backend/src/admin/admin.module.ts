import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationEntity } from '../database/entities/organization.entity';
import { SubscriptionEntity } from '../database/entities/subscription.entity';
import { UsageCounterEntity } from '../database/entities/usage-counter.entity';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrganizationEntity,
      SubscriptionEntity,
      UsageCounterEntity,
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
