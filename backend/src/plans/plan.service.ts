import { ForbiddenException, Injectable } from '@nestjs/common';
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

/**
 * نام فارسی امکانات پلن، برای پیام خطا.
 *
 * بدون نام درست، کاربر پیام «feature X نیست» می‌گرفت و نمی‌دانست باید چه
 * چیزی را ارتقا دهد.
 */
export const FEATURE_LABELS: Record<string, string> = {
  logicDisplay: 'منطق شرطی نمایش',
  logicSkip: 'منطق پرش و فلوچارت',
  indices: 'شاخص و وزن‌دهی',
  multiLanguage: 'فرم چندزبانه',
  smsPanel: 'پنل پیامکی',
  emailPanel: 'پنل ایمیلی',
  embed: 'جاسازی در سایت (Embed و Pop-up)',
  kiosk: 'کیوسک',
  interviewer: 'پرسشگر میدانی',
  portal: 'پرتال',
  webhooks: 'وبهوک',
  dashboards: 'داشبوردساز',
  api: 'API برنامه‌نویسان',
  advancedExcel: 'خروجی اکسل پیشرفته',
  powerpointExport: 'خروجی PowerPoint',
  customDomain: 'دامنه‌ی اختصاصی',
  aiCreate: 'ساخت پرسشنامه با هوش مصنوعی',
  aiReview: 'بازنگری با هوش مصنوعی',
  aiAnalyze: 'تحلیل پاسخ‌ها با هوش مصنوعی',
  workspaceUsers: 'کاربر سازمان',
};

const featureName = (key: string) => FEATURE_LABELS[key] ?? key;

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
    // اشتراکِ منقضی‌شده دیگر امتیازی نمی‌دهد و سازمان به پلن رایگان برمی‌گردد.
    if (subscription?.expiresAt && subscription.expiresAt < new Date()) {
      return PlanCode.FREE;
    }
    return subscription?.planCode ?? PlanCode.FREE;
  }

  /**
   * امکان بولی پلن (مثل `embed` یا `logicSkip`).
   *
   * تا پیش از این جدول پلن فقط نمایشی بود: همه‌ی این امکانات در پلن رایگان
   * هم کار می‌کردند.
   */
  async assertFeature(organizationId: string, key: string): Promise<void> {
    const limits = await this.getPolicyByOrganization(organizationId);
    if (limits[key] !== true) {
      throw new ForbiddenException(
        `«${featureName(key)}» در پلن فعلی سازمان شما نیست؛ برای استفاده پلن را ارتقا دهید`,
      );
    }
  }

  /**
   * سقف شمارشی پلن (مثل تعداد کیوسک یا داشبورد).
   *
   * `used` تعداد فعلی است؛ ۱- یعنی نامحدود و ۰ یعنی این امکان در پلن نیست.
   */
  async assertQuota(
    organizationId: string,
    key: string,
    used: number,
  ): Promise<void> {
    const limits = await this.getPolicyByOrganization(organizationId);
    const limit = Number(limits[key] ?? 0);
    if (limit === -1) return;
    if (limit === 0) {
      throw new ForbiddenException(
        `«${featureName(key)}» در پلن فعلی سازمان شما نیست؛ برای استفاده پلن را ارتقا دهید`,
      );
    }
    if (used >= limit) {
      throw new ForbiddenException(
        `سقف «${featureName(key)}» در پلن شما ${limit.toLocaleString('fa-IR')} است و پر شده`,
      );
    }
  }

  /** سازمانِ یک فضای کاری؛ برای بررسی سقف از روی فرم و فضای کاری. */
  async organizationOfWorkspace(workspaceId: string): Promise<string | null> {
    const workspace = await this.workspaceRepo.findOne({
      where: { id: workspaceId },
      select: { id: true, organizationId: true },
    });
    return workspace?.organizationId ?? null;
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
