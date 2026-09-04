import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformSettingsEntity } from '../database/entities/platform-settings.entity';
import { UserEntity } from '../database/entities/user.entity';
import { PlatformController } from './platform.controller';
import { PlatformSettingsService } from './platform-settings.service';

@Module({
  imports: [TypeOrmModule.forFeature([PlatformSettingsEntity, UserEntity])],
  controllers: [PlatformController],
  providers: [PlatformSettingsService],
  // ماژول عمومی هم برای ساخت نوار پایین به این سرویس نیاز دارد.
  exports: [PlatformSettingsService, TypeOrmModule],
})
export class PlatformModule {}
