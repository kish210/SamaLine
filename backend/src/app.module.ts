import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { FormModule } from './forms/form.module';
import { PublicModule } from './public/public.module';
import { ResponseModule } from './responses/response.module';
import { WorkspaceModule } from './workspaces/workspace.module';
import { PlanModule } from './plans/plan.module';
import { ReportModule } from './reports/report.module';
import { AiModule } from './ai/ai.module';
import { IntegrationsModule } from './integrations/integrations.module';
import { AdminModule } from './admin/admin.module';
import { DistributionModule } from './distribution/distribution.module';
import { OrganizationModule } from './organization/organization.module';
import { ChannelsModule } from './channels/channels.module';
import { BillingModule } from './billing/billing.module';
import { ApiKeyEntity } from './database/entities/api-key.entity';
import { AuditLogEntity } from './database/entities/audit-log.entity';
import { AnswerFlatEntity } from './database/entities/answer-flat.entity';
import { DeliveryLogEntity } from './database/entities/delivery-log.entity';
import { FormEntity } from './database/entities/form.entity';
import { FormVersionEntity } from './database/entities/form-version.entity';
import { IdentityProviderEntity } from './database/entities/identity-provider.entity';
import { InterviewerQuotaEntity } from './database/entities/interviewer-quota.entity';
import { InvoiceEntity } from './database/entities/invoice.entity';
import { KioskSessionEntity } from './database/entities/kiosk-session.entity';
import { OnPremLicenseEntity } from './database/entities/onprem-license.entity';
import { PaymentEntity } from './database/entities/payment.entity';
import { OrganizationEntity } from './database/entities/organization.entity';
import { OrganizationUserEntity } from './database/entities/organization-user.entity';
import { PlanPolicyEntity } from './database/entities/plan-policy.entity';
import { PublicationEntity } from './database/entities/publication.entity';
import { ResponseCommentEntity } from './database/entities/response-comment.entity';
import { ResponseEntity } from './database/entities/response.entity';
import { SavedFilterEntity } from './database/entities/saved-filter.entity';
import { SubscriptionEntity } from './database/entities/subscription.entity';
import { UserEntity } from './database/entities/user.entity';
import { UsageCounterEntity } from './database/entities/usage-counter.entity';
import { WebhookEntity } from './database/entities/webhook.entity';
import { WorkspaceEntity } from './database/entities/workspace.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        entities: [
          UserEntity,
          OrganizationEntity,
          OrganizationUserEntity,
          WorkspaceEntity,
          FormEntity,
          FormVersionEntity,
          PublicationEntity,
          ResponseEntity,
          AnswerFlatEntity,
          PlanPolicyEntity,
          SubscriptionEntity,
          UsageCounterEntity,
          WebhookEntity,
          AuditLogEntity,
          ResponseCommentEntity,
          SavedFilterEntity,
          DeliveryLogEntity,
          ApiKeyEntity,
          IdentityProviderEntity,
          KioskSessionEntity,
          InterviewerQuotaEntity,
          InvoiceEntity,
          PaymentEntity,
          OnPremLicenseEntity,
        ],
        synchronize: false,
      }),
    }),
    AuthModule,
    WorkspaceModule,
    FormModule,
    PublicModule,
    ResponseModule,
    PlanModule,
    ReportModule,
    AiModule,
    IntegrationsModule,
    AdminModule,
    DistributionModule,
    OrganizationModule,
    ChannelsModule,
    BillingModule,
  ],
})
export class AppModule {}
