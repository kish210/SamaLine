import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SuperAdminGuard } from '../common/super-admin.guard';
import { UserEntity } from '../database/entities/user.entity';
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
      UserEntity,
    ]),
  ],
  controllers: [AdminController],
  providers: [AdminService, SuperAdminGuard],
})
export class AdminModule {}
