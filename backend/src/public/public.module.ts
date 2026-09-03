import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnswerFlatEntity } from '../database/entities/answer-flat.entity';
import { FormVersionEntity } from '../database/entities/form-version.entity';
import { PublicationEntity } from '../database/entities/publication.entity';
import { ResponseEntity } from '../database/entities/response.entity';
import { FormModule } from '../forms/form.module';
import { PlanModule } from '../plans/plan.module';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PublicationEntity,
      FormVersionEntity,
      ResponseEntity,
      AnswerFlatEntity,
    ]),
    PlanModule,
    FormModule,
  ],
  providers: [PublicService],
  controllers: [PublicController],
})
export class PublicModule {}
