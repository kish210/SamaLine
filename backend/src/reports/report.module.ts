import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnswerFlatEntity } from '../database/entities/answer-flat.entity';
import { ResponseEntity } from '../database/entities/response.entity';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';

@Module({
  imports: [TypeOrmModule.forFeature([ResponseEntity, AnswerFlatEntity])],
  controllers: [ReportController],
  providers: [ReportService],
})
export class ReportModule {}
