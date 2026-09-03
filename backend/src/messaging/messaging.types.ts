/** کانال‌های ارسال پیام. */
export type MessageChannel = 'sms' | 'email';

/** یک پیام آماده‌ی ارسال. */
export interface OutboundMessage {
  channel: MessageChannel;
  /** شماره موبایل یا آدرس ایمیل گیرنده. */
  recipient: string;
  /** موضوع — فقط برای ایمیل. */
  subject?: string;
  body: string;
  /** داده‌ی همراه برای لاگ و ردیابی (شناسه انتشار، توکن یکتا و …). */
  meta?: Record<string, unknown>;
}

export type DeliveryStatus = 'queued' | 'sent' | 'delivered' | 'failed';

export interface DeliveryResult {
  status: DeliveryStatus;
  /** پیام یا خطای برگشتی از سرویس‌دهنده. */
  providerMessage: string | null;
  /** شناسه‌ی پیام نزد سرویس‌دهنده، در صورت وجود. */
  externalId?: string | null;
}

/**
 * قرارداد سرویس‌دهنده‌ی ارسال.
 *
 * پیاده‌سازی پیش‌فرض (`local`) پیام را در فایل می‌نویسد تا سامانه بدون
 * هیچ سرویس بیرونی کار کند؛ با تنظیم متغیر محیطی می‌توان به سرویس
 * واقعی (کاوه‌نگار، SMTP و …) سوئیچ کرد.
 */
export interface MessagingProvider {
  readonly name: string;
  readonly channel: MessageChannel;
  send(message: OutboundMessage): Promise<DeliveryResult>;
}
