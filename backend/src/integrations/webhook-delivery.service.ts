import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac } from 'node:crypto';
import { Repository } from 'typeorm';
import { assertPublicUrl } from '../contacts/url-guard';
import { WebhookEntity } from '../database/entities/webhook.entity';
import { DurableQueueService } from '../messaging/durable-queue.service';

export const WEBHOOK_JOB = 'webhook.deliver';

/** رویدادهایی که واقعا فرستاده می‌شوند. */
export const WEBHOOK_EVENTS = ['response.completed'] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

const TIMEOUT_MS = Number(process.env.WEBHOOK_TIMEOUT_MS ?? 10000);
const MAX_ATTEMPTS = Number(process.env.WEBHOOK_MAX_ATTEMPTS ?? 5);

/** امضای HMAC-SHA256 روی دقیقا همان بایت‌هایی که فرستاده می‌شود. */
export function signWebhookBody(secret: string, body: string): string {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

/**
 * تحویل واقعی وبهوک.
 *
 * پیش از این وبهوک فقط ذخیره می‌شد و هیچ رویدادی هرگز فرستاده نمی‌شد.
 * حالا با هر پاسخ کامل، برای هر وبهوک فعال سازمان یک کار در صف پایدار
 * ثبت می‌شود؛ پس قطعی مقصد یا ری‌استارت سرور رویداد را گم نمی‌کند و تا
 * پنج بار با فاصله‌ی فزاینده دوباره تلاش می‌شود.
 *
 * گیرنده امضا را با راز وبهوک روی بدنه‌ی خام می‌سنجد:
 *   X-SamaLine-Signature: sha256=<hex(HMAC-SHA256(secret, rawBody))>
 *
 * نشانی مقصد پیش از هر ارسال از محافظ SSRF می‌گذرد و تغییر مسیر دنبال
 * نمی‌شود؛ وگرنه وبهوک راهی برای درخواست زدن به شبکه‌ی داخلی سرور بود.
 */
@Injectable()
export class WebhookDeliveryService implements OnModuleInit {
  private readonly logger = new Logger(WebhookDeliveryService.name);

  constructor(
    @InjectRepository(WebhookEntity)
    private readonly webhooks: Repository<WebhookEntity>,
    private readonly queue: DurableQueueService,
  ) {}

  onModuleInit() {
    this.queue.register(WEBHOOK_JOB, (payload) => this.deliver(payload));
  }

  /**
   * ثبت رویداد برای همه‌ی وبهوک‌های فعال سازمان.
   *
   * هرگز خطا بیرون نمی‌دهد: ثبت پاسخ پاسخ‌دهنده نباید گروگان وبهوک باشد.
   */
  async dispatch(
    organizationId: string,
    event: WebhookEvent,
    data: Record<string, unknown>,
  ): Promise<number> {
    try {
      const hooks = await this.webhooks.find({
        where: { organizationId, event, isActive: true },
      });
      for (const hook of hooks) {
        await this.queue.enqueue(
          WEBHOOK_JOB,
          {
            webhookId: hook.id,
            event,
            occurredAt: new Date().toISOString(),
            data,
          },
          { maxAttempts: MAX_ATTEMPTS },
        );
      }
      return hooks.length;
    } catch (error) {
      this.logger.warn(
        `ثبت رویداد وبهوک ناموفق بود: ${(error as Error).message}`,
      );
      return 0;
    }
  }

  /** یک تحویل؛ خطا یعنی تلاش دوباره توسط صف. */
  async deliver(payload: Record<string, unknown>): Promise<void> {
    const webhookId =
      typeof payload.webhookId === 'string' ? payload.webhookId : '';
    const hook = webhookId
      ? await this.webhooks.findOne({ where: { id: webhookId } })
      : null;
    // وبهوکی که در این فاصله حذف یا غیرفعال شده، بی‌صدا کنار می‌رود.
    if (!hook || !hook.isActive) return;

    const check = await assertPublicUrl(hook.targetUrl);
    if (!check.allowed) {
      // تلاش دوباره نتیجه را عوض نمی‌کند؛ کار بی‌خطا تمام می‌شود.
      this.logger.warn(`وبهوک ${hook.id} رد شد: ${check.reason}`);
      return;
    }

    const body = JSON.stringify({
      event: payload.event,
      occurredAt: payload.occurredAt,
      data: payload.data,
    });

    const response = await fetch(hook.targetUrl, {
      method: 'POST',
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        'content-type': 'application/json',
        'user-agent': 'SamaLine-Webhook/1',
        'x-samaline-event': String(payload.event),
        'x-samaline-signature': signWebhookBody(hook.secret, body),
      },
      body,
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`مقصد وبهوک پاسخ ${response.status} داد`);
    }
  }
}
