import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformModule } from '../platform/platform.module';
import { OrganizationEntity } from '../database/entities/organization.entity';
import { OrganizationUserEntity } from '../database/entities/organization-user.entity';
import { SubscriptionEntity } from '../database/entities/subscription.entity';
import { UserEntity } from '../database/entities/user.entity';
import { WorkspaceEntity } from '../database/entities/workspace.entity';
import { MessagingModule } from '../messaging/messaging.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { PasswordService } from './password.service';
import { TwoFactorService } from './two-factor.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      OrganizationEntity,
      OrganizationUserEntity,
      WorkspaceEntity,
      SubscriptionEntity,
    ]),
    PlatformModule,
    // ایمیل بازیابی رمز از همان لایه‌ی ارسال پیام سامانه می‌رود.
    MessagingModule,
    PassportModule,
    ConfigModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'change-me'),
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  providers: [AuthService, JwtStrategy, TwoFactorService, PasswordService],
  controllers: [AuthController],
  // تیم برای پذیرش دعوت همان نشست و ورود دومرحله‌ای را لازم دارد.
  exports: [AuthService, TwoFactorService],
})
export class AuthModule {}
