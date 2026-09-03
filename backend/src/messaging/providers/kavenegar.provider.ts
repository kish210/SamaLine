import type {
  DeliveryResult,
  MessageChannel,
  MessagingProvider,
  OutboundMessage,
} from '../messaging.types';

/**
 * سرویس‌دهنده‌ی پیامک کاوه‌نگار.
 *
 * فقط با تنظیم `SMS_PROVIDER=kavenegar` و `KAVENEGAR_API_KEY` فعال می‌شود؛
 * در غیر این صورت سامانه از سرویس‌دهنده‌ی محلی استفاده می‌کند.
 * از fetch بومی Node استفاده می‌کند تا وابستگی جدیدی اضافه نشود.
 */
export class KavenegarProvider implements MessagingProvider {
  readonly name = 'kavenegar';
  readonly channel: MessageChannel = 'sms';

  constructor(
    private readonly apiKey: string,
    private readonly sender = process.env.KAVENEGAR_SENDER ?? '',
    private readonly timeoutMs = Number(process.env.SMS_TIMEOUT_MS ?? 10000),
  ) {}

  async send(message: OutboundMessage): Promise<DeliveryResult> {
    const url = `https://api.kavenegar.com/v1/${this.apiKey}/sms/send.json`;
    const params = new URLSearchParams({
      receptor: message.recipient,
      message: message.body,
    });
    if (this.sender) params.set('sender', this.sender);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
        signal: controller.signal,
      });

      const text = await response.text();
      if (!response.ok) {
        return {
          status: 'failed',
          providerMessage: `خطای کاوه‌نگار (${response.status}): ${text.slice(0, 300)}`,
        };
      }

      const parsed = JSON.parse(text) as {
        entries?: Array<{ messageid?: number }>;
      };
      return {
        status: 'sent',
        providerMessage: 'ارسال شد',
        externalId: parsed.entries?.[0]?.messageid?.toString() ?? null,
      };
    } catch (error) {
      return {
        status: 'failed',
        providerMessage:
          error instanceof Error ? error.message : 'خطای نامشخص در ارسال پیامک',
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
