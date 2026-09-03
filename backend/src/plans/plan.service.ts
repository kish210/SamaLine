import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FormEntity, FormStatus } from '../database/entities/form.entity';
import {
  PlanCode,
  PlanPolicyEntity,
} from '../database/entities/plan-policy.entity';
import { SubscriptionEntity } from '../database/entities/subscription.entity';
import { UsageCounterEntity } from '../database/entities/usage-counter.entity';
import { WorkspaceEntity } from '../database/entities/workspace.entity';

@Injectable()
export class PlanService {
  constructor(
    @InjectRepository(PlanPolicyEntity)
    private readonly policyRepo: Repository<PlanPolicyEntity>,
    @InjectRepository(SubscriptionEntity)
    private readonly subscriptionRepo: Repository<SubscriptionEntity>,
    @InjectRepository(UsageCounterEntity)
    private readonly usageRepo: Repository<UsageCounterEntity>,
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepo: Repository<WorkspaceEntity>,
    @InjectRepository(FormEntity)
    private readonly formRepo: Repository<FormEntity>,
  ) {}

  async resolvePlan(organizationId: string) {
    const subscription = await this.subscriptionRepo.findOne({
      where: { organizationId, isActive: true },
      order: { createdAt: 'DESC' },
    });
    return subscription?.planCode ?? PlanCode.FREE;
  }

  async getPolicyByOrganization(organizationId: string) {
    const planCode = await this.resolvePlan(organizationId);
    const policy = await this.policyRepo.findOne({ where: { planCode } });
    return policy?.limits ?? {};
  }

  async canCreateForm(workspaceId: string) {
    const workspace = await this.workspaceRepo.findOne({
      where: { id: workspaceId },
    });
    if (!workspace) return { allowed: false, reason: 'فضای کاری نامعتبر است' };

    const limits = (await this.getPolicyByOrganization(
      workspace.organizationId,
    )) as { activeForms?: number };
    const activeForms = await this.formRepo.count({
      where: { workspaceId, status: FormStatus.ACTIVE },
    });

    const maxActive = Number(limits.activeForms ?? -1);
    if (maxActive >= 0 && activeForms >= maxActive) {
      return { allowed: false, reason: 'سقف فرم فعال پلن شما تکمیل شده است' };
    }

    return { allowed: true, reason: null };
  }

  async getWorkspacePolicy(workspaceId: string) {
    const workspace = await this.workspaceRepo.findOne({
      where: { id: workspaceId },
    });
    if (!workspace) return null;
    return this.getPolicyByOrganization(workspace.organizationId);
  }

  /**
   * آیا سازمان هنوز در سقف پاسخ‌نامه‌ی ماهانه‌ی پلن خود جا دارد؟
   *
   * سقف تا پیش از این فقط ثبت می‌شد و هرگز اعمال نمی‌شد؛ یعنی پلن رایگان
   * عملا پاسخ نامحدود می‌پذیرفت.
   */
  async canAcceptResponse(organizationId: string) {
    const limits = (await this.getPolicyByOrganization(organizationId)) as {
      responsesPerMonth?: number;
    };
    const limit = Number(limits.responsesPerMonth ?? -1);

    // مقدار منفی یعنی نامحدود.
    if (!Number.isFinite(limit) || limit < 0) {
      return { allowed: true, reason: null, used: 0, limit };
    }

    const periodKey = PlanService.currentPeriodKey();
    const counter = await this.usageRepo.findOne({
      where: { organizationId, periodKey, metric: 'response_submitted' },
    });
    const used = counter?.used ?? 0;

    return used >= limit
      ? {
          allowed: false,
          reason: `سقف پاسخ‌نامه ماهانه پلن شما (${limit}) تکمیل شده است`,
          used,
          limit,
        }
      : { allowed: true, reason: null, used, limit };
  }

  /** کلید دوره‌ی مصرف: سال-ماه میلادی به وقت UTC. */
  private static currentPeriodKey() {
    return new Date().toISOString().slice(0, 7);
  }

  async trackUsage(organizationId: string, metric: string, amount = 1) {
    const periodKey = PlanService.currentPeriodKey();
    const limits = await this.getPolicyByOrganization(organizationId);
    const metricLimitMap: Record<string, string> = {
      response_submitted: 'responsesPerMonth',
    };
    const limitKey = metricLimitMap[metric];
    const limitValue = Number(limitKey ? (limits[limitKey] as number) : 0);

    let counter = await this.usageRepo.findOne({
      where: { organizationId, periodKey, metric },
    });
    if (!counter) {
      counter = this.usageRepo.create({
        organizationId,
        periodKey,
        metric,
        used: 0,
        limitValue: Number.isFinite(limitValue) ? limitValue : 0,
      });
    }
    counter.used += amount;
    return this.usageRepo.save(counter);
  }
}
