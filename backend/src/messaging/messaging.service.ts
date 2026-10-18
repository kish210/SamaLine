import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DeliveryLogEntity } from '../database/entities/delivery-log.entity';
import { DurableQueueService } from './durable-queue.service';
import { InProcessQueue } from './in-process-queue';
import type {
  DeliveryResult,
  MessageChannel,
  MessagingProvider,
  OutboundMessage,
} from './messaging.types';
import { KavenegarProvider } from './providers/kavenegar.provider';
import { LocalFileProvider } from './providers/local-file.provider';
import { SmtpProvider, smtpConfigFromEnv } from './providers/smtp.provider';
import { WebhookProvider } from './providers/webhook.provider';

/** نوع کار صف برای ارسال یک پیام. */
export const MESSAGE_JOB = 'message.send';

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);
  private readonly providers = new Map<MessageChannel, MessagingProvider>();
  private readonly inProcess = new InProcessQueue({
    concurrency: Number(process.env.MESSAGING_CONCURRENCY ?? 5),
    maxAttempts: Number(process.env.MESSAGING_MAX_ATTEMPTS ?? 3),
    retryDelayMs: Number(process.env.MESSAGING_RETRY_DELAY_MS ?? 500),
  });

  constructor(
    @InjectRepository(DeliveryLogEntity)
    private readonly logRepo: Repository<DeliveryLogEntity>,
    private readonly queue: DurableQueueService,
  ) {
    // پردازشگر کار ارسال؛ صف پایدار آن را در پس‌زمینه صدا می‌زند.
    this.queue.register(MESSAGE_JOB, async (payload) => {
      const { message, publicationId } = payload as {
        message: OutboundMessage;
        publicationId: string | null;
      };
      const result = await this.send(message, publicationId ?? undefined);
      if (result.status === 'failed') {
        // شکست را به صف اعلام می‌کنیم تا تلاش مجدد انجام شود.
        throw new Error(result.providerMessage ?? 'ارسال ناموفق بود');
      }
    });

    this.providers.set('sms', this.resolveProvider('sms'));
    this.providers.set('email', this.resolveProvider('email'));
    this.logger.log(
      `سرویس‌دهنده پیامک: ${this.providers.get('sms')?.name} | ایمیل: ${this.providers.get('email')?.name}`,
    );
  }

  /** نام سرویس‌دهنده‌ی فعال هر کانال — برای نمایش در پنل. */
  get activeProviders() {
    return {
      sms: this.providers.get('sms')?.name ?? 'local',
      email: this.providers.get('email')?.name ?? 'local',
    };
  }

  /** آمار صف درون‌فرایندی (ارسال فوری). */
  get queueStats() {
    return this.inProcess.stats;
  }

  /** آمار صف پایدار (ارسال انبوه). */
  durableQueueStats() {
    return this.queue.stats();
  }

  /**
   * ارسال یک پیام: از صف عبور می‌کند (تلاش مجدد و محدودیت هم‌روندی)
   * و نتیجه در جدول لاگ تحویل ثبت می‌شود.
   */
  async send(
    message: OutboundMessage,
    publicationId?: string,
  ): Promise<DeliveryResult> {
    const provider =
      this.providers.get(message.channel) ??
      new LocalFileProvider(message.channel);

    let result: DeliveryResult;
    try {
      result = await this.inProcess.add(() => provider.send(message));
    } catch (error) {
      result = {
        status: 'failed',
        providerMessage:
          error instanceof Error
            ? error.message
            : 'ارسال پس از چند تلاش ناموفق ماند',
      };
    }

    if (publicationId) {
      await this.recordDelivery(publicationId, message, result, provider.name);
    }

    return result;
  }

  /** ارسال انبوه: همه از یک صف با هم‌روندی محدود عبور می‌کنند. */
  async sendBulk(messages: OutboundMessage[], publicationId?: string) {
    const results = await Promise.all(
      messages.map((message) => this.send(message, publicationId)),
    );

    return {
      total: results.length,
      sent: results.filter((r) => r.status === 'sent').length,
      failed: results.filter((r) => r.status === 'failed').length,
      results,
    };
  }

  /**
   * ارسال انبوه پایدار: پیام‌ها پیش از ارسال در دیتابیس ثبت می‌شوند و
   * پس‌زمینه آن‌ها را می‌فرستد.
   *
   * برای کمپین‌های بزرگ مناسب است: پاسخ فورا برمی‌گردد و ری‌استارت
   * سرور باعث گم شدن پیام‌های نرفته نمی‌شود.
   */
  async queueBulk(messages: OutboundMessage[], publicationId?: string) {
    for (const message of messages) {
      await this.queue.enqueue(MESSAGE_JOB, {
        message: message,
        publicationId: publicationId ?? null,
      });
    }

    return { queued: messages.length };
  }

  private async recordDelivery(
    publicationId: string,
    message: OutboundMessage,
    result: DeliveryResult,
    providerName: string,
  ) {
    await this.logRepo.save(
      this.logRepo.create({
        publicationId,
        channel: message.channel,
        status: result.status,
        payload: {
          recipient: message.recipient,
          subject: message.subject ?? null,
          provider: providerName,
          externalId: result.externalId ?? null,
          ...(message.meta ?? {}),
        },
        providerMessage: result.providerMessage,
      }),
    );
  }

  /**
   * انتخاب سرویس‌دهنده از روی متغیر محیطی.
   * پیش‌فرض همیشه `local` است تا سامانه بدون پیکربندی هم کار کند.
   */
  private resolveProvider(channel: MessageChannel): MessagingProvider {
    const key = channel === 'sms' ? 'SMS_PROVIDER' : 'EMAIL_PROVIDER';
    const choice = (process.env[key] ?? 'local').toLowerCase();

    if (choice === 'kavenegar' && channel === 'sms') {
      const apiKey = process.env.KAVENEGAR_API_KEY;
      if (apiKey) return new KavenegarProvider(apiKey);
      this.logger.warn(
        'KAVENEGAR_API_KEY تنظیم نشده؛ به سرویس‌دهنده محلی برگشت داده شد',
      );
      return new LocalFileProvider(channel);
    }

    if (choice === 'webhook') {
      const endpoint =
        process.env[
          channel === 'sms' ? 'SMS_WEBHOOK_URL' : 'EMAIL_WEBHOOK_URL'
        ];
      if (endpoint) return new WebhookProvider(channel, endpoint);
      this.logger.warn(
        `آدرس وبهوک برای کانال ${channel} تنظیم نشده؛ به سرویس‌دهنده محلی برگشت داده شد`,
      );
      return new LocalFileProvider(channel);
    }

    if (choice === 'smtp' && channel === 'email') {
      const config = smtpConfigFromEnv();
      if (config) return new SmtpProvider(config);
      this.logger.warn(
        'SMTP_HOST تنظیم نشده؛ به سرویس‌دهنده محلی برگشت داده شد',
      );
      return new LocalFileProvider(channel);
    }

    return new LocalFileProvider(channel);
  }
}
