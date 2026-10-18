import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKeyEntity } from '../database/entities/api-key.entity';
import { WorkspaceEntity } from '../database/entities/workspace.entity';
import { ApiKeyAuthService } from './api-key-auth.service';

/**
 * سراسری، چون `JwtAuthGuard` روی ده‌ها کنترلر در ماژول‌های مختلف می‌نشیند.
 *
 * بدون `@Global`، هر ماژولی که آن گارد را به کار می‌برد باید این ماژول را
 * هم import می‌کرد و یادِ یکی که می‌رفت، آن مسیر بی‌صدا کلید API را
 * نمی‌پذیرفت.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([ApiKeyEntity, WorkspaceEntity])],
  providers: [ApiKeyAuthService],
  exports: [ApiKeyAuthService],
})
export class ApiKeyAuthModule {}
