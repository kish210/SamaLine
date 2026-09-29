import { createHmac, randomBytes } from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebhookEntity } from '../database/entities/webhook.entity';
import { assertPublicUrl } from '../contacts/url-guard';
import { PlanService } from '../plans/plan.service';
import { CreateWebhookDto } from './dto';

@Injectable()
export class IntegrationsService {
  constructor(
    @InjectRepository(WebhookEntity)
    private readonly webhookRepo: Repository<WebhookEntity>,
    private readonly plans: PlanService,
  ) {}

  /**
   * ثبت وبهوک.
   *
   * - سقف تعداد از پلن سازمان (`webhooks`؛ ۱- یعنی نامحدود).
   * - نشانی داخلی همین‌جا رد می‌شود، نه اولین بار هنگام تحویل.
   * - راز امضا اگر داده نشود ساخته می‌شود؛ رازِ حدس‌زدنی امضا را بی‌ارزش می‌کند.
   */
  async createWebhook(dto: CreateWebhookDto & { organizationId: string }) {
    const limits = (await this.plans.getPolicyByOrganization(
      dto.organizationId,
    )) as { webhooks?: number };
    const limit = Number(limits.webhooks ?? 0);
    if (limit !== -1) {
      const active = await this.webhookRepo.count({
        where: { organizationId: dto.organizationId, isActive: true },
      });
      if (active >= limit) {
        throw new ForbiddenException(
          limit === 0
            ? 'وبهوک در پلن فعلی سازمان شما نیست'
            : `سقف ${limit} وبهوک پلن شما پر شده است`,
        );
      }
    }

    const check = await assertPublicUrl(dto.targetUrl);
    if (!check.allowed) {
      throw new BadRequestException(check.reason ?? 'نشانی مجاز نیست');
    }

    return this.webhookRepo.save(
      this.webhookRepo.create({
        organizationId: dto.organizationId,
        event: dto.event,
        targetUrl: dto.targetUrl,
        secret: dto.secret ?? randomBytes(24).toString('hex'),
        isActive: true,
      }),
    );
  }

  /** حذف (غیرفعال‌سازی) وبهوک سازمان خودِ کاربر. */
  async removeWebhook(id: string, organizationId: string) {
    const hook = await this.webhookRepo.findOne({
      where: { id, organizationId },
    });
    if (!hook) throw new NotFoundException('وبهوک یافت نشد');
    hook.isActive = false;
    await this.webhookRepo.save(hook);
    return { ok: true };
  }

  listWebhooks(organizationId: string) {
    return this.webhookRepo.find({
      where: { organizationId, isActive: true },
      order: { createdAt: 'DESC' },
    });
  }

  signPayload(secret: string, payload: Record<string, unknown>) {
    return createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
  }

  verifySignature(
    secret: string,
    payload: Record<string, unknown>,
    signature: string,
  ) {
    const expected = this.signPayload(secret, payload);
    return {
      valid: expected === signature,
      expectedSignature: expected,
    };
  }

  async buildDispatch(
    event: string,
    organizationId: string,
    payload: Record<string, unknown>,
  ) {
    const hooks = await this.webhookRepo.find({
      where: { event, organizationId, isActive: true },
    });
    return hooks.map((hook) => ({
      url: hook.targetUrl,
      signature: this.signPayload(hook.secret, payload),
      payload,
      retryPolicy: { maxAttempts: 5, strategy: 'exponential-backoff' },
    }));
  }
}
