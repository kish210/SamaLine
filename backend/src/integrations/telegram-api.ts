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
    /*
     * پیام‌ها با HTML نوشته می‌شوند (تلگرام با parse_mode=HTML رندر می‌کند).
     * اما بله parse_mode ندارد و طبق مستند رسمی‌اش «همه‌ی پیام‌ها را خودکار
     * Markdown قالب‌بندی می‌کند» (پررنگ با دو ستاره). پس اگر همان HTML را به
     * بله بفرستیم، کاربر تگ خام <b> می‌بیند. برای بله HTML را به Markdownِ بله
     * تبدیل می‌کنیم و parse_mode نمی‌فرستیم.
     */
    const isBale = baseUrl === BALE_API;
    const prepared = isBale ? htmlToBaleMarkdown(text) : text;
    const body: Record<string, unknown> = {
      chat_id: chatId,
      text: prepared.length > MAX_MESSAGE ? clip(prepared) : prepared,
    };
    if (!isBale) {
      body.parse_mode = 'HTML';
      body.disable_web_page_preview = true;
    }
    return this.call(botToken, 'sendMessage', body, baseUrl);
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
/**
 * تبدیل پیامِ HTML (که برای تلگرام ساخته شده) به Markdownِ بله.
 *
 * - `<b>…</b>` → `**…**` (پررنگ بله با دو ستاره است، نه یک).
 * - بقیه‌ی تگ‌ها حذف می‌شوند (پیام‌های ما جز <b> تگ دیگری ندارند، ولی برای
 *   اطمینان).
 * - موجودیت‌های HTML (`&amp;` و …) به کاراکتر اصلی برمی‌گردند، چون سازنده‌ی
 *   پیام آن‌ها را برای HTML گریز زده بود و بله خام نمایش‌شان می‌دهد.
 */
export function htmlToBaleMarkdown(html: string): string {
  return html
    .replace(/<\/?b>/g, '**')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function clip(text: string): string {
  return `${text.slice(0, MAX_MESSAGE - 40)}\n\n… (ادامه در پنل)`;
}
