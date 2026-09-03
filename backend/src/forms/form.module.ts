import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FormEntity } from '../database/entities/form.entity';
import { FormVersionEntity } from '../database/entities/form-version.entity';
import { PublicationEntity } from '../database/entities/publication.entity';
import { PlanModule } from '../plans/plan.module';
import { FormController } from './form.controller';
import { FormService } from './form.service';
import { LogicEngineService } from './logic-engine.service';
import { LogicRuntimeService } from './logic-runtime.service';
import { ScoreEngineService } from './score-engine.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FormEntity,
      FormVersionEntity,
      PublicationEntity,
    ]),
    PlanModule,
  ],
  providers: [
    FormService,
    LogicEngineService,
    LogicRuntimeService,
    ScoreEngineService,
  ],
  controllers: [FormController],
  exports: [
    FormService,
    LogicEngineService,
    LogicRuntimeService,
    ScoreEngineService,
  ],
})
export class FormModule {}
