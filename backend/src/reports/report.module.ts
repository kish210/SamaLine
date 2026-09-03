import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnswerFlatEntity } from '../database/entities/answer-flat.entity';
import { FormVersionEntity } from '../database/entities/form-version.entity';
import { ResponseEntity } from '../database/entities/response.entity';
import { SavedFilterEntity } from '../database/entities/saved-filter.entity';
import { ReportController } from './report.controller';
import { ExportService } from './export.service';
import { ReportService } from './report.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ResponseEntity,
      AnswerFlatEntity,
      SavedFilterEntity,
      FormVersionEntity,
    ]),
  ],
  controllers: [ReportController],
  providers: [ReportService, ExportService],
})
export class ReportModule {}
