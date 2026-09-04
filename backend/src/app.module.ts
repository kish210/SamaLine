import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { FormModule } from './forms/form.module';
import { PublicModule } from './public/public.module';
import { ResponseModule } from './responses/response.module';
import { WorkspaceModule } from './workspaces/workspace.module';
import { PlatformModule } from './platform/platform.module';
import { UploadModule } from './uploads/upload.module';
import { PlanModule } from './plans/plan.module';
import { ReportModule } from './reports/report.module';
import { AiModule } from './ai/ai.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { AdminModule } from './admin/admin.module';
import { DistributionModule } from './distribution/distribution.module';
import { OrganizationModule } from './organization/organization.module';
import { ChannelsModule } from './channels/channels.module';
import { BillingModule } from './billing/billing.module';
import { MessagingModule } from './messaging/messaging.module';
import { ContactsModule } from './contacts/contacts.module';
import { SpecializedModule } from './specialized/specialized.module';
import { buildDataSourceOptions } from './database/data-source';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot(buildDataSourceOptions()),
    AuthModule,
    WorkspaceModule,
    FormModule,
    PublicModule,
    ResponseModule,
    PlanModule,
    PlatformModule,
    UploadModule,
    ReportModule,
    AiModule,
    IntegrationsModule,
    AdminModule,
    DistributionModule,
    OrganizationModule,
    ChannelsModule,
    BillingModule,
    MessagingModule,
    ContactsModule,
    SpecializedModule,
  ],
})
export class AppModule {}
