import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PlanCode } from '../database/entities/plan-policy.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationEntity } from '../database/entities/organization.entity';
import { SubscriptionEntity } from '../database/entities/subscription.entity';
import { UsageCounterEntity } from '../database/entities/usage-counter.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(OrganizationEntity)
    private readonly orgRepo: Repository<OrganizationEntity>,
    @InjectRepository(SubscriptionEntity)
    private readonly subRepo: Repository<SubscriptionEntity>,
    @InjectRepository(UsageCounterEntity)
    private readonly usageRepo: Repository<UsageCounterEntity>,
  ) {}

  async setPlan(
    organizationId: string,
    planCode: PlanCode,
    expiresAt?: string,
  ) {
    const organization = await this.orgRepo.findOne({
      where: { id: organizationId },
    });
    if (!organization) throw new NotFoundException('سازمان یافت نشد');

    const expiry = expiresAt ? new Date(expiresAt) : null;
    if (expiry && Number.isNaN(expiry.getTime())) {
      throw new BadRequestException('تاریخ انقضا نامعتبر است');
    }

    await this.subRepo.update(
      { organizationId, isActive: true },
      { isActive: false },
    );
    return this.subRepo.save(
      this.subRepo.create({
        organizationId,
        planCode,
        isActive: true,
        expiresAt: expiry,
      }),
    );
  }

  async organizationsOverview() {
    const organizations = await this.orgRepo.find({
      order: { createdAt: 'DESC' },
      take: 100,
    });
    return Promise.all(
      organizations.map(async (organization) => {
        const subscription = await this.subRepo.findOne({
          where: { organizationId: organization.id, isActive: true },
          order: { createdAt: 'DESC' },
        });
        const usage = await this.usageRepo.find({
          where: { organizationId: organization.id },
        });
        return {
          organization,
          subscription,
          usage,
        };
      }),
    );
  }
}
