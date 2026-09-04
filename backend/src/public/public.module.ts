import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnswerFlatEntity } from '../database/entities/answer-flat.entity';
import { FormVersionEntity } from '../database/entities/form-version.entity';
import { OtpChallengeEntity } from '../database/entities/otp-challenge.entity';
import { PublicationEntity } from '../database/entities/publication.entity';
import { ResponseEntity } from '../database/entities/response.entity';
import { FormModule } from '../forms/form.module';
import { MessagingModule } from '../messaging/messaging.module';
import { PlanModule } from '../plans/plan.module';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';
import { RespondentAuthService } from './respondent-auth.service';
import { PlatformModule } from '../platform/platform.module';

@Module({
  imports: [
    PlatformModule,
    TypeOrmModule.forFeature([
      PublicationEntity,
      FormVersionEntity,
      ResponseEntity,
      AnswerFlatEntity,
      OtpChallengeEntity,
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
  providers: [PublicService, RespondentAuthService],
  controllers: [PublicController],
})
export class PublicModule {}
