import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FormEntity } from '../database/entities/form.entity';
import { PublicationEntity } from '../database/entities/publication.entity';
import { WorkspaceEntity } from '../database/entities/workspace.entity';
import { PlatformModule } from '../platform/platform.module';
import { TenantAccessService } from './tenant-access.service';

/**
 * ماژول مشترک بررسی دسترسی مستاجر.
 *
 * جدا نگه داشته شده تا هر ماژولی که شناسه‌ی فضای کاری یا فرم را از درخواست
 * می‌گیرد بتواند همان یک بررسی را وارد کند؛ کپی کردن این منطق در چند جا
 * یعنی یکی از کپی‌ها دیر یا زود عقب می‌ماند.
 */
@Module({
  imports: [
    PlatformModule,
    TypeOrmModule.forFeature([WorkspaceEntity, FormEntity, PublicationEntity]),
  ],
  providers: [TenantAccessService],
  exports: [TenantAccessService],
})
export class TenantAccessModule {}
