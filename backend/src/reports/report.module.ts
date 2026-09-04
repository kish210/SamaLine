import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnswerFlatEntity } from '../database/entities/answer-flat.entity';
import { DashboardEntity } from '../database/entities/dashboard.entity';
import { FormEntity } from '../database/entities/form.entity';
import { FormVersionEntity } from '../database/entities/form-version.entity';
import { WorkspaceEntity } from '../database/entities/workspace.entity';
import { ResponseEntity } from '../database/entities/response.entity';
import { SavedFilterEntity } from '../database/entities/saved-filter.entity';
import { PublicationEntity } from '../database/entities/publication.entity';
import { ReportController } from './report.controller';
import {
  DashboardController,
  PublicDashboardController,
} from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { ExportService } from './export.service';
import { ReportService } from './report.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ResponseEntity,
      AnswerFlatEntity,
      SavedFilterEntity,
      FormVersionEntity,
      DashboardEntity,
      FormEntity,
      WorkspaceEntity,
      PublicationEntity,
    ]),
  ],
  controllers: [
    ReportController,
    DashboardController,
    PublicDashboardController,
  ],
  providers: [ReportService, ExportService, DashboardService],
})
export class ReportModule {}
