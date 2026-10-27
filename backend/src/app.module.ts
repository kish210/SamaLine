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
import { RemindersModule } from './reminders/reminders.module';
import { OpsModule } from './ops/ops.module';
import { TeamModule } from './team/team.module';
import { MenuModule } from './menus/menu.module';
import { DepartmentsModule } from './departments/departments.module';
import { ChecklistsModule } from './checklists/checklists.module';
import { RoomsModule } from './rooms/rooms.module';
import { HrModule } from './hr/hr.module';
import { HotelSetupModule } from './hotel-setup/hotel-setup.module';
import { ApiKeyAuthModule } from './common/api-key-auth.module';
import { buildDataSourceOptions } from './database/data-source';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot(buildDataSourceOptions()),
    // سراسری: گارد توکن روی همه‌ی ماژول‌ها به آن نیاز دارد.
    ApiKeyAuthModule,
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
    RemindersModule,
    OpsModule,
    TeamModule,
    MenuModule,
    DepartmentsModule,
    ChecklistsModule,
    RoomsModule,
    HrModule,
    HotelSetupModule,
  ],
})
export class AppModule {}
