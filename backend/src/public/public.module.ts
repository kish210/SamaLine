import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnswerFlatEntity } from '../database/entities/answer-flat.entity';
import { FormVersionEntity } from '../database/entities/form-version.entity';
import { PublicationEntity } from '../database/entities/publication.entity';
import { ResponseEntity } from '../database/entities/response.entity';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';

@Module({
  imports: [TypeOrmModule.forFeature([PublicationEntity, FormVersionEntity, ResponseEntity, AnswerFlatEntity])],
  providers: [PublicService],
  controllers: [PublicController],
})
export class PublicModule {}
