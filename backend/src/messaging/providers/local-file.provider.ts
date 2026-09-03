import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import type {
  DeliveryResult,
  MessageChannel,
  MessagingProvider,
  OutboundMessage,
} from '../messaging.types';

/**
 * سرویس‌دهنده‌ی پیش‌فرض: پیام را به‌جای ارسال واقعی در یک فایل
 * صندوق خروجی می‌نویسد.
 *
 * این کار سامانه را خوداتکا می‌کند — توسعه، تست و نصب On-Premise بدون
 * حساب پیامکی یا SMTP هم کاملا کار می‌کند و همه‌ی پیام‌ها قابل بازبینی‌اند.
 */
export class LocalFileProvider implements MessagingProvider {
  readonly name = 'local';

  constructor(
    readonly channel: MessageChannel,
    private readonly outboxPath = process.env.OUTBOX_PATH ?? 'data/outbox',
  ) {}

  async send(message: OutboundMessage): Promise<DeliveryResult> {
    const file = this.resolveFile();
    await mkdir(dirname(file), { recursive: true });

    const record = {
      at: new Date().toISOString(),
      channel: message.channel,
      recipient: message.recipient,
      subject: message.subject ?? null,
      body: message.body,
      meta: message.meta ?? {},
    };

    await appendFile(file, `${JSON.stringify(record)}\n`, 'utf8');

    return {
      status: 'sent',
      providerMessage: `در صندوق خروجی محلی ثبت شد: ${file}`,
      externalId: null,
    };
  }

  private resolveFile(): string {
    const base = isAbsolute(this.outboxPath)
      ? this.outboxPath
      : resolve(process.cwd(), this.outboxPath);
    return resolve(base, `${this.channel}.jsonl`);
  }
}
