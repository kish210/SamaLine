import type {
  DeliveryResult,
  MessageChannel,
  MessagingProvider,
  OutboundMessage,
} from '../messaging.types';

/**
 * سرویس‌دهنده‌ی عمومی مبتنی بر HTTP.
 *
 * پیام را به یک آدرس دلخواه POST می‌کند؛ برای اتصال به هر پنل پیامکی،
 * سرویس ایمیل یا سامانه‌ی داخلی سازمان بدون نوشتن کد جدید.
 * با `SMS_PROVIDER=webhook` یا `EMAIL_PROVIDER=webhook` فعال می‌شود.
 */
export class WebhookProvider implements MessagingProvider {
  readonly name = 'webhook';

  constructor(
    readonly channel: MessageChannel,
    private readonly endpoint: string,
    private readonly authHeader = process.env.MESSAGING_WEBHOOK_AUTH ?? '',
    private readonly timeoutMs = Number(
      process.env.MESSAGING_TIMEOUT_MS ?? 10000,
    ),
  ) {}

  async send(message: OutboundMessage): Promise<DeliveryResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const headers: Record<string, string> = {
        'content-type': 'application/json',
      };
      if (this.authHeader) headers.authorization = this.authHeader;

      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(message),
        signal: controller.signal,
      });

      const text = await response.text();
      return response.ok
        ? { status: 'sent', providerMessage: text.slice(0, 300) || 'ارسال شد' }
        : {
            status: 'failed',
            providerMessage: `خطای سرویس‌دهنده (${response.status}): ${text.slice(0, 300)}`,
          };
    } catch (error) {
      return {
        status: 'failed',
        providerMessage:
          error instanceof Error ? error.message : 'خطای نامشخص در ارسال',
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
