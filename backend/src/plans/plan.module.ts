import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FormEntity } from '../database/entities/form.entity';
import { PlanPolicyEntity } from '../database/entities/plan-policy.entity';
import { SubscriptionEntity } from '../database/entities/subscription.entity';
import { UsageCounterEntity } from '../database/entities/usage-counter.entity';
import { WorkspaceEntity } from '../database/entities/workspace.entity';
import { PlanController } from './plan.controller';
import { PlanService } from './plan.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PlanPolicyEntity,
      SubscriptionEntity,
      UsageCounterEntity,
      WorkspaceEntity,
      FormEntity,
    ]),
  ],
  controllers: [PlanController],
  providers: [PlanService],
  exports: [PlanService],
})
export class PlanModule {}
