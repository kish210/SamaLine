import { Module } from '@nestjs/common';
import { TenantAccessModule } from '../common/tenant-access.module';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnswerFlatEntity } from '../database/entities/answer-flat.entity';
import { FormVersionEntity } from '../database/entities/form-version.entity';
import { DepartmentMemberEntity } from '../database/entities/department-member.entity';
import { OrganizationUserEntity } from '../database/entities/organization-user.entity';
import { OtpChallengeEntity } from '../database/entities/otp-challenge.entity';
import { PublicationEntity } from '../database/entities/publication.entity';
import { ResponseEntity } from '../database/entities/response.entity';
import { FormModule } from '../forms/form.module';
import { MessagingModule } from '../messaging/messaging.module';
import { PlanModule } from '../plans/plan.module';
import { PublicController } from './public.controller';
import {
  PortalAdminController,
  PublicPortalController,
} from './portal.controller';
import { PortalService } from './portal.service';
import { PublicService } from './public.service';
import { PortalEntity } from '../database/entities/portal.entity';
import { FormEntity } from '../database/entities/form.entity';
import { WorkspaceEntity } from '../database/entities/workspace.entity';
import { RespondentAuthService } from './respondent-auth.service';
import { PlatformModule } from '../platform/platform.module';
import { IntegrationsModule } from '../integrations/integrations.module';

@Module({
  imports: [
    TenantAccessModule,
    PlatformModule,
    IntegrationsModule,
    TypeOrmModule.forFeature([
      PublicationEntity,
      FormVersionEntity,
      ResponseEntity,
      AnswerFlatEntity,
      OtpChallengeEntity,
      PortalEntity,
      FormEntity,
      WorkspaceEntity,
      OrganizationUserEntity,
      DepartmentMemberEntity,
    ]),
    PlanModule,
    FormModule,
    MessagingModule,
    // اعتبار پاسخ‌دهنده با همان راز سرور امضا می‌شود ولی payload آن
    // با توکن کاربران پنل فرق دارد و فقط برای همان انتشار معتبر است.
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'change-me',
    }),
  ],
  providers: [PublicService, RespondentAuthService, PortalService],
  controllers: [
    PublicController,
    PortalAdminController,
    PublicPortalController,
  ],
})
export class PublicModule {}
