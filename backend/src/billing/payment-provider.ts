import { Logger } from '@nestjs/common';

export interface StartPaymentInput {
  paymentId: string;
  amount: number;
  description: string;
  callbackUrl: string;
  mobile?: string;
  email?: string;
}

export interface StartPaymentResult {
  /** نشانی‌ای که کاربر برای پرداخت به آن فرستاده می‌شود. */
  redirectUrl: string;
  /** شناسه‌ی تراکنش نزد درگاه. */
  authority: string;
}

export interface VerifyPaymentInput {
  authority: string;
  amount: number;
}

export interface VerifyPaymentResult {
  paid: boolean;
  referenceCode: string | null;
  message: string;
}

/**
 * قرارداد درگاه پرداخت.
 *
 * نکته‌ی حیاتی: تایید پرداخت باید از خود درگاه پرسیده شود، نه از
 * کلاینت. پیش از این، وضعیت موفق/ناموفق را کلاینت می‌فرستاد و هر کسی
 * می‌توانست فاکتور را تسویه‌شده اعلام کند.
 */
export interface PaymentProvider {
  readonly name: string;
  start(input: StartPaymentInput): Promise<StartPaymentResult>;
  verify(input: VerifyPaymentInput): Promise<VerifyPaymentResult>;
}

/**
 * درگاه ساختگی برای توسعه و نصب On-Premise بدون حساب پرداخت.
 *
 * پرداخت را همیشه موفق اعلام می‌کند، پس **هرگز نباید در محیط واقعی
 * استفاده شود**؛ هنگام راه‌اندازی هشدار می‌دهد.
 */
export class LocalPaymentProvider implements PaymentProvider {
  readonly name = 'local';
  private readonly logger = new Logger(LocalPaymentProvider.name);
  private readonly started = new Map<string, number>();

  constructor(
    private readonly baseUrl = process.env.PAYMENT_LOCAL_BASE_URL ??
      'http://localhost:3000/api/v1/billing/local-gateway',
  ) {}

  start(input: StartPaymentInput): Promise<StartPaymentResult> {
    const authority = `local-${input.paymentId}`;
    this.started.set(authority, input.amount);

    this.logger.warn(
      'درگاه پرداخت روی حالت محلی است و هر پرداختی موفق شمرده می‌شود؛ برای محیط واقعی PAYMENT_PROVIDER را تنظیم کنید.',
    );

    return Promise.resolve({
      authority,
      redirectUrl: `${this.baseUrl}?authority=${authority}&callback=${encodeURIComponent(input.callbackUrl)}`,
    });
  }

  verify(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    const expected = this.started.get(input.authority);

    // حتی در حالت محلی، مبلغ باید با آنچه شروع شده بخواند تا رفتار
    // با درگاه واقعی یکسان بماند.
    if (expected !== undefined && expected !== input.amount) {
      return Promise.resolve({
        paid: false,
        referenceCode: null,
        message: 'مبلغ تراکنش با مبلغ اولیه نمی‌خواند',
      });
    }

    return Promise.resolve({
      paid: true,
      referenceCode: `LOCAL-${Date.now()}`,
      message: 'پرداخت در حالت محلی تایید شد',
    });
  }
}

/**
 * زرین‌پال — درگاه پرداخت ایرانی.
 * با `PAYMENT_PROVIDER=zarinpal` و `ZARINPAL_MERCHANT_ID` فعال می‌شود.
 */
export class ZarinpalProvider implements PaymentProvider {
  readonly name = 'zarinpal';
  private readonly logger = new Logger(ZarinpalProvider.name);

  constructor(
    private readonly merchantId: string,
    private readonly baseUrl = process.env.ZARINPAL_BASE_URL ??
      'https://payment.zarinpal.com',
    private readonly timeoutMs = Number(
      process.env.PAYMENT_TIMEOUT_MS ?? 20000,
    ),
  ) {}

  async start(input: StartPaymentInput): Promise<StartPaymentResult> {
    const payload = await this.post('/pg/v4/payment/request.json', {
      merchant_id: this.merchantId,
      // زرین‌پال مبلغ را به ریال می‌گیرد.
      amount: input.amount,
      description: input.description,
      callback_url: input.callbackUrl,
      metadata: {
        mobile: input.mobile,
        email: input.email,
      },
    });

    const authority = payload?.data?.authority;
    if (!authority) {
      throw new Error(
        `درگاه شناسه تراکنش نداد: ${JSON.stringify(payload?.errors ?? {})}`,
      );
    }

    return {
      authority,
      redirectUrl: `${this.baseUrl}/pg/StartPay/${authority}`,
    };
  }

  async verify(input: VerifyPaymentInput): Promise<VerifyPaymentResult> {
    const payload = await this.post('/pg/v4/payment/verify.json', {
      merchant_id: this.merchantId,
      amount: input.amount,
      authority: input.authority,
    });

    // کد ۱۰۰ یعنی تایید موفق، ۱۰۱ یعنی قبلا تایید شده.
    const code = Number(payload?.data?.code ?? 0);
    const paid = code === 100 || code === 101;

    return {
      paid,
      referenceCode: paid ? String(payload?.data?.ref_id ?? '') : null,
      message: paid
        ? 'پرداخت تایید شد'
        : `تایید ناموفق (کد ${code || 'نامشخص'})`,
    };
  }

  private async post(
    path: string,
    body: Record<string, unknown>,
  ): Promise<ZarinpalResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      return (await response.json()) as ZarinpalResponse;
    } catch (error) {
      this.logger.error(
        error instanceof Error ? error.message : 'خطای نامشخص درگاه',
      );
      throw new Error('ارتباط با درگاه پرداخت برقرار نشد');
    } finally {
      clearTimeout(timer);
    }
  }
}

interface ZarinpalResponse {
  data?: { authority?: string; code?: number; ref_id?: number };
  errors?: unknown;
}

/** انتخاب درگاه از متغیر محیطی؛ پیش‌فرض محلی است. */
export function resolvePaymentProvider(): PaymentProvider {
  const choice = (process.env.PAYMENT_PROVIDER ?? 'local').toLowerCase();
  const merchantId = process.env.ZARINPAL_MERCHANT_ID;

  if (choice === 'zarinpal' && merchantId) {
    return new ZarinpalProvider(merchantId);
  }

  return new LocalPaymentProvider();
}
