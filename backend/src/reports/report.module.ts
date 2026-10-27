import { Module } from '@nestjs/common';
import { TenantAccessModule } from '../common/tenant-access.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnswerFlatEntity } from '../database/entities/answer-flat.entity';
import { DashboardEntity } from '../database/entities/dashboard.entity';
import { FormEntity } from '../database/entities/form.entity';
import { FormVersionEntity } from '../database/entities/form-version.entity';
import { WorkspaceEntity } from '../database/entities/workspace.entity';
import { ResponseEntity } from '../database/entities/response.entity';
import { SavedFilterEntity } from '../database/entities/saved-filter.entity';
import { PublicationEntity } from '../database/entities/publication.entity';
import { PlanModule } from '../plans/plan.module';
import { ReportController } from './report.controller';
import {
  DashboardController,
  PublicDashboardController,
} from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { ExportService } from './export.service';
import { ReportService } from './report.service';
import { AnalyticsService } from './analytics.service';

@Module({
  imports: [
    TenantAccessModule,
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
    PlanModule,
  ],
  controllers: [
    ReportController,
    DashboardController,
    PublicDashboardController,
  ],
  providers: [ReportService, ExportService, DashboardService, AnalyticsService],
  // گزارش دوره‌ای تلگرام از همین تجمیع استفاده می‌کند.
  exports: [AnalyticsService, DashboardService],
})
export class ReportModule {}
