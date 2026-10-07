import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKeyEntity } from '../database/entities/api-key.entity';
import { IdentityProviderEntity } from '../database/entities/identity-provider.entity';
import { PlanModule } from '../plans/plan.module';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ApiKeyEntity, IdentityProviderEntity]),
    PlanModule,
  ],
  controllers: [OrganizationController],
  providers: [OrganizationService],
})
export class OrganizationModule {}
