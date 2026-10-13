import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { ApiKeyEntity } from '../database/entities/api-key.entity';
import { IdentityProviderEntity } from '../database/entities/identity-provider.entity';
import { OrganizationRole } from '../database/entities/organization-user.entity';
import { PlanService } from '../plans/plan.service';
import { CreateApiKeyDto, CreateIdentityProviderDto } from './dto';

@Injectable()
export class OrganizationService {
  constructor(
    @InjectRepository(ApiKeyEntity)
    private readonly apiKeyRepo: Repository<ApiKeyEntity>,
    @InjectRepository(IdentityProviderEntity)
    private readonly identityRepo: Repository<IdentityProviderEntity>,
    private readonly plans: PlanService,
  ) {}

  async createApiKey(dto: CreateApiKeyDto) {
    // کلید ساختن یعنی استفاده از API؛ امکان پلن است.
    if (dto.organizationId) {
      await this.plans.assertFeature(dto.organizationId, 'api');
    }
    const plain = `sl_${randomBytes(18).toString('hex')}`;
    const keyPrefix = plain.slice(0, 16);
    const keyHash = createHash('sha256').update(plain).digest('hex');

    const saved = await this.apiKeyRepo.save(
      this.apiKeyRepo.create({
        organizationId: dto.organizationId,
        name: dto.name,
        keyPrefix,
        keyHash,
        role: dto.role ?? OrganizationRole.VIEWER,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        scopes: { items: dto.scopes ?? [] },
        isActive: true,
      }),
    );

    return {
      id: saved.id,
      name: saved.name,
      keyPrefix: saved.keyPrefix,
      role: saved.role,
      expiresAt: saved.expiresAt,
      // کلید کامل فقط همین یک بار برمی‌گردد؛ در دیتابیس فقط هشش می‌ماند.
      apiKey: plain,
    };
  }

  listApiKeys(organizationId: string) {
    return this.apiKeyRepo.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
      // هش کلید هرگز از API بیرون نمی‌رود.
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        role: true,
        isActive: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
    });
  }

  async revokeApiKey(id: string, organizationId: string) {
    // فقط کلیدِ سازمان خودِ کاربر؛ کلید سازمان دیگر «یافت نشد» می‌گیرد.
    const key = await this.apiKeyRepo.findOne({
      where: { id, organizationId },
    });
    if (!key) throw new NotFoundException('کلید API یافت نشد');
    key.isActive = false;
    await this.apiKeyRepo.save(key);
    return { ok: true };
  }

  createIdentityProvider(dto: CreateIdentityProviderDto) {
    return this.identityRepo.save(
      this.identityRepo.create({
        organizationId: dto.organizationId,
        type: dto.type,
        name: dto.name,
        config: dto.config ?? {},
        isActive: true,
      }),
    );
  }

  listIdentityProviders(organizationId: string) {
    return this.identityRepo.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
  }
}
