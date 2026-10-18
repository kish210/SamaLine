import { createTransport, type Transporter } from 'nodemailer';
import type {
  DeliveryResult,
  MessagingProvider,
  OutboundMessage,
} from '../messaging.types';

/** بخش‌هایی از پاسخ nodemailer که استفاده می‌شوند. */
interface SentInfo {
  rejected?: unknown[];
  response?: string;
  messageId?: string;
}

export interface SmtpConfig {
  host: string;
  port: number;
  /** true برای درگاه ۴۶۵ (TLS مستقیم)؛ برای ۵۸۷ با STARTTLS false بماند. */
  secure: boolean;
  user?: string;
  pass?: string;
  /** فرستنده، مثل `SamaLine <no-reply@example.com>`. */
  from: string;
}

/** تنظیمات SMTP از متغیرهای محیطی؛ بدون SMTP_HOST مقدار null. */
export function smtpConfigFromEnv(env = process.env): SmtpConfig | null {
  const host = env.SMTP_HOST?.trim();
  if (!host) return null;
  const port = Number(env.SMTP_PORT ?? 587);
  const user = env.SMTP_USER?.trim() || undefined;
  return {
    host,
    port,
    secure: env.SMTP_SECURE ? env.SMTP_SECURE === 'true' : port === 465,
    user,
    pass: env.SMTP_PASS || undefined,
    from: env.SMTP_FROM?.trim() || user || `no-reply@${host}`,
  };
}

const escapeHtml = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * نسخه‌ی HTML پیام.
 *
 * متن پیام‌ها ساده است؛ ولی بدون جهت راست‌به‌چپ، بیشتر برنامه‌های ایمیل متن
 * فارسی را چپ‌چین و با نشانه‌گذاری به‌هم‌ریخته نشان می‌دهند. نشانی‌ها قابل
 * کلیک می‌شوند تا لینک فرم یا بازیابی رمز مستقیم باز شود.
 */
export function toHtml(body: string): string {
  const linked = escapeHtml(body).replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" dir="ltr">$1</a>',
  );
  return `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;font-size:14px;line-height:1.9;text-align:right">${linked.replace(/\n/g, '<br>')}</div>`;
}

/**
 * ارسال ایمیل با SMTP — سرور ایمیل سازمان، Gmail، Zoho یا هر سرویس دیگر.
 *
 * با `EMAIL_PROVIDER=smtp` و `SMTP_HOST` فعال می‌شود. اتصال یک بار ساخته و
 * برای ارسال‌های بعدی نگه داشته می‌شود (pool) تا کمپین‌های بزرگ برای هر
 * ایمیل دوباره دست‌دهی TLS نکنند.
 */
export class SmtpProvider implements MessagingProvider {
  readonly name = 'smtp';
  readonly channel = 'email' as const;
  private readonly transport: Transporter;

  constructor(
    private readonly config: SmtpConfig,
    transport?: Transporter,
  ) {
    this.transport =
      transport ??
      createTransport({
        host: config.host,
        port: config.port,
        secure: config.secure,
        pool: true,
        maxConnections: 3,
        connectionTimeout: 15_000,
        greetingTimeout: 15_000,
        socketTimeout: 30_000,
        auth: config.user
          ? { user: config.user, pass: config.pass }
          : undefined,
      });
  }

  /** بستن اتصال‌های نگه‌داشته‌شده (pool). */
  close(): void {
    this.transport.close();
  }

  async send(message: OutboundMessage): Promise<DeliveryResult> {
    try {
      const info = (await this.transport.sendMail({
        from: this.config.from,
        to: message.recipient,
        subject: message.subject || 'پیام سامانه',
        text: message.body,
        html: toHtml(message.body),
      })) as SentInfo;
      const rejected = (info.rejected ?? []).length > 0;
      return rejected
        ? {
            status: 'failed',
            providerMessage: `گیرنده رد شد: ${String(info.response ?? '')}`,
          }
        : {
            status: 'sent',
            providerMessage: String(info.response ?? 'ارسال شد').slice(0, 300),
            externalId: info.messageId ?? null,
          };
    } catch (error) {
      return {
        status: 'failed',
        providerMessage:
          error instanceof Error ? error.message : 'خطای نامشخص در ارسال ایمیل',
      };
    }
  }
}
