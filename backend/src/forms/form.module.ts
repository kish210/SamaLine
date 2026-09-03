import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FormEntity } from '../database/entities/form.entity';
import { FormVersionEntity } from '../database/entities/form-version.entity';
import { PublicationEntity } from '../database/entities/publication.entity';
import { PlanModule } from '../plans/plan.module';
import { FormController } from './form.controller';
import { FormService } from './form.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FormEntity,
      FormVersionEntity,
      PublicationEntity,
    ]),
    PlanModule,
  ],
  providers: [FormService],
  controllers: [FormController],
  exports: [FormService],
})
export class FormModule {}
