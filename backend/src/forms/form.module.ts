import { Module } from '@nestjs/common';
import { TenantAccessModule } from '../common/tenant-access.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FormEntity } from '../database/entities/form.entity';
import { FormVersionEntity } from '../database/entities/form-version.entity';
import { ResponseEntity } from '../database/entities/response.entity';
import { PublicationEntity } from '../database/entities/publication.entity';
import { PlanModule } from '../plans/plan.module';
import { FormController } from './form.controller';
import { FormService } from './form.service';
import { LogicEngineService } from './logic-engine.service';
import { LogicRuntimeService } from './logic-runtime.service';
import { ScoreEngineService } from './score-engine.service';

@Module({
  imports: [
    TenantAccessModule,
    TypeOrmModule.forFeature([
      FormEntity,
      FormVersionEntity,
      ResponseEntity,
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
