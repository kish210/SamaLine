import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantAccessModule } from '../common/tenant-access.module';
import { PlatformModule } from '../platform/platform.module';
import { MenuEntity } from '../database/entities/menu.entity';
import { MenuController, PublicMenuController } from './menu.controller';
import { MenuService } from './menu.service';

@Module({
  imports: [
    TenantAccessModule,
    PlatformModule,
    TypeOrmModule.forFeature([MenuEntity]),
  ],
  controllers: [MenuController, PublicMenuController],
  providers: [MenuService],
})
export class MenuModule {}
