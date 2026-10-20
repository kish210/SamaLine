import { Injectable } from '@nestjs/common';

const TELEGRAM_API = 'https://api.telegram.org';
/**
 * بله (bale.ai) پیام‌رسان ایرانی است و API ربات آن با تلگرام سازگار است؛
 * فقط نشانی پایه فرق می‌کند. چون تلگرام در ایران فیلتر است، بله مقصد عملی‌تری
 * برای اطلاع‌رسانی است.
 */
const BALE_API = 'https://tapi.bale.ai';

export type ChatPlatform = 'telegram' | 'bale';

/** نشانی پایه‌ی API برای هر پیام‌رسان. */
export function platformApiBase(platform?: string | null): string {
  return platform === 'bale' ? BALE_API : TELEGRAM_API;
}

/** حداکثر طول پیام تلگرام؛ پیام بلندتر رد می‌شود، پس بریده می‌شود. */
export const MAX_MESSAGE = 4096;

/** بدون مهلت، یک تلگرام کند مسیر ثبت پاسخ را نگه می‌دارد. */
const TIMEOUT_MS = 8000;

export type TelegramResult<T> = ({ ok: true } & T) | TelegramFailure;

export type TelegramFailure = { ok: false; error: string };

/** نتیجه‌ی فراخوانی‌هایی که خروجی جز موفقیت/شکست ندارند. */
export type TelegramOk = { ok: true } | TelegramFailure;

/**
 * تماس‌های HTTP با API تلگرام.
 *
 * جدا از منطق اطلاع‌رسانی نگه داشته شده تا هم سرویس ارسال و هم سرویس
 * فرمان‌های ربات یک پیاده‌سازی مشترک داشته باشند؛ دو نسخه‌ی موازی با گذشت
 * زمان در مهلت، گریز کاراکترها و مدیریت خطا از هم واگرا می‌شوند.
 */
@Injectable()
export class TelegramApi {
  async send(
    botToken: string,
    chatId: string,
    text: string,
    baseUrl: string = TELEGRAM_API,
  ): Promise<TelegramOk> {
    return this.call(
      botToken,
      'sendMessage',
      {
        chat_id: chatId,
        text: text.length > MAX_MESSAGE ? clip(text) : text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      },
      baseUrl,
    );
  }

  async getMe(
    botToken: string,
    baseUrl: string = TELEGRAM_API,
  ): Promise<TelegramResult<{ username: string | null }>> {
    const result = await this.call<{ username?: string }>(
      botToken,
      'getMe',
      undefined,
      baseUrl,
    );
    if (!result.ok) return result;
    return { ok: true, username: result.result?.username ?? null };
  }

  /** ثبت نشانی وبهوک؛ پیام‌رسان پیام‌های کاربران را به آنجا می‌فرستد. */
  async setWebhook(
    botToken: string,
    url: string,
    baseUrl: string = TELEGRAM_API,
  ): Promise<TelegramOk> {
    return this.call(
      botToken,
      'setWebhook',
      {
        url,
        // فقط پیام‌ها لازم است؛ گرفتن بقیه‌ی رویدادها ترافیک بی‌مصرف است.
        allowed_updates: ['message'],
        drop_pending_updates: true,
      },
      baseUrl,
    );
  }

  async deleteWebhook(
    botToken: string,
    baseUrl: string = TELEGRAM_API,
  ): Promise<TelegramOk> {
    return this.call(
      botToken,
      'deleteWebhook',
      { drop_pending_updates: true },
      baseUrl,
    );
  }

  async getUpdates(
    botToken: string,
    baseUrl: string = TELEGRAM_API,
  ): Promise<TelegramResult<{ updates: unknown[] }>> {
    const result = await this.call<unknown[]>(
      botToken,
      'getUpdates?limit=100',
      undefined,
      baseUrl,
    );
    if (!result.ok) return result;
    return { ok: true, updates: result.result ?? [] };
  }

  private async call<T>(
    botToken: string,
    method: string,
    body?: Record<string, unknown>,
    baseUrl: string = TELEGRAM_API,
  ): Promise<TelegramResult<{ result?: T }>> {
    try {
      const response = await fetch(`${baseUrl}/bot${botToken}/${method}`, {
        method: body ? 'POST' : 'GET',
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      const payload = (await response.json()) as {
        ok?: boolean;
        description?: string;
        result?: T;
      };

      if (!response.ok || !payload.ok) {
        return {
          ok: false,
          error: payload.description ?? `پاسخ ${response.status}`,
        };
      }
      return { ok: true, result: payload.result };
    } catch (error) {
      return { ok: false, error: (error as Error).message };
    }
  }
}

/** پیام‌های خیلی بلند را تلگرام رد می‌کند؛ بریدن بهتر از نفرستادن است. */
function clip(text: string): string {
  return `${text.slice(0, MAX_MESSAGE - 40)}\n\n… (ادامه در پنل)`;
}
