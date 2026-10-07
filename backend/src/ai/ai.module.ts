import { Module } from '@nestjs/common';
import { PlanModule } from '../plans/plan.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

@Module({
  imports: [PlanModule],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
