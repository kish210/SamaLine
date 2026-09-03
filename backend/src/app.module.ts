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
import { AuditLogEntity } from './database/entities/audit-log.entity';
import { AnswerFlatEntity } from './database/entities/answer-flat.entity';
import { FormEntity } from './database/entities/form.entity';
import { FormVersionEntity } from './database/entities/form-version.entity';
import { OrganizationEntity } from './database/entities/organization.entity';
import { OrganizationUserEntity } from './database/entities/organization-user.entity';
import { PlanPolicyEntity } from './database/entities/plan-policy.entity';
import { PublicationEntity } from './database/entities/publication.entity';
import { ResponseEntity } from './database/entities/response.entity';
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
  ],
})
export class AppModule {}
