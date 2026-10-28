import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformSettingsEntity } from '../database/entities/platform-settings.entity';
import { UserEntity } from '../database/entities/user.entity';
import { WorkspaceEntity } from '../database/entities/workspace.entity';
import { OrganizationEntity } from '../database/entities/organization.entity';
import { FormEntity } from '../database/entities/form.entity';
import { ResponseEntity } from '../database/entities/response.entity';
import { DepartmentEntity } from '../database/entities/department.entity';
import { PersonnelEntity } from '../database/entities/personnel.entity';
import { PlatformController } from './platform.controller';
import { PlatformSettingsService } from './platform-settings.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PlatformSettingsEntity,
      UserEntity,
      WorkspaceEntity,
      OrganizationEntity,
      FormEntity,
      ResponseEntity,
      DepartmentEntity,
      PersonnelEntity,
    ]),
  ],
  controllers: [PlatformController],
  providers: [PlatformSettingsService],
  // ماژول عمومی هم برای ساخت نوار پایین به این سرویس نیاز دارد.
  exports: [PlatformSettingsService, TypeOrmModule],
})
export class PlatformModule {}
