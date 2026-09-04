/**
 * شناسه‌ی پاسخ‌دهنده.
 *
 * پیش از این از خود پاسخ‌دهنده پرسیده می‌شد که هم بی‌معنا بود (کاربر
 * نمی‌داند چه بنویسد) و هم قابل اتکا نبود. حالا سیستم می‌سازدش و در همان
 * مرورگر نگه می‌دارد تا «ذخیره‌ی پیشرفت» بین بازدیدها کار کند.
 *
 * شناسه‌ی آمده از لینک (پارامتر `r` در کمپین‌ها) همیشه اولویت دارد، چون
 * آنجا شناسه به یک مخاطب مشخص گره خورده است.
 */
const PREFIX = 'samaline:rk:';

function randomKey(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();

  // مرورگرهای قدیمی‌تر یا زمینه‌ی ناامن (http روی دامنه‌ی غیر localhost).
  const bytes = new Uint8Array(16);
  if (cryptoApi?.getRandomValues) {
    cryptoApi.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** شناسه‌ی پایدار این مرورگر برای این فرم. */
export function resolveRespondentKey(
  token: string | undefined,
  fromUrl: string,
): string {
  if (fromUrl) return fromUrl;
  if (!token) return randomKey();

  const storageKey = `${PREFIX}${token}`;
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) return stored;
    const fresh = randomKey();
    localStorage.setItem(storageKey, fresh);
    return fresh;
  } catch {
    // حالت ناشناس یا مسدود بودن ذخیره‌سازی؛ شناسه‌ی موقت هم کافی است.
    return randomKey();
  }
}
