import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * رمز یک‌بارمصرف زمان‌محور (TOTP، RFC 6238) برای ورود دومرحله‌ای پنل.
 *
 * با Google Authenticator، Microsoft Authenticator، Aegis و هر برنامه‌ی
 * استاندارد دیگر کار می‌کند. فقط با `node:crypto` نوشته شده تا وابستگی
 * تازه‌ای به نصب اضافه نشود.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_SECONDS = 30;
const DIGITS = 6;

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index === -1) throw new Error('کلید base32 نامعتبر است');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** کلید تازه‌ی ۱۶۰ بیتی (اندازه‌ی پیشنهادی RFC 4226). */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** شماره‌ی بازه‌ی ۳۰ ثانیه‌ای برای یک لحظه. */
export function timeStep(nowMs: number): number {
  return Math.floor(nowMs / 1000 / STEP_SECONDS);
}

/** کد یک بازه‌ی مشخص (HOTP با شمارنده‌ی زمانی). */
export function totpCode(
  secret: string,
  step: number,
  digits = DIGITS,
): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac('sha1', base32Decode(secret))
    .update(counter)
    .digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3];
  return String(binary % 10 ** digits).padStart(digits, '0');
}

/**
 * سنجش کد وارد شده.
 *
 * یک بازه قبل و بعد هم پذیرفته می‌شود تا اختلاف ساعت گوشی و سرور ورود را
 * نشکند. بازه‌ای که قبلا مصرف شده (`lastUsedStep`) دوباره پذیرفته نمی‌شود؛
 * وگرنه کدی که کسی از پشت سر دیده تا ۹۰ ثانیه قابل استفاده می‌ماند.
 *
 * خروجی: شماره‌ی بازه‌ی پذیرفته‌شده، یا null.
 */
export function verifyTotp(
  secret: string,
  code: string,
  options: {
    nowMs?: number;
    lastUsedStep?: number | null;
    window?: number;
  } = {},
): number | null {
  const normalized = toLatinDigits(code).replace(/\s/g, '');
  if (!/^\d{6}$/.test(normalized)) return null;

  const current = timeStep(options.nowMs ?? Date.now());
  const window = options.window ?? 1;
  for (let delta = -window; delta <= window; delta += 1) {
    const step = current + delta;
    if (options.lastUsedStep != null && step <= options.lastUsedStep) continue;
    const expected = totpCode(secret, step);
    if (timingSafeEqual(Buffer.from(expected), Buffer.from(normalized))) {
      return step;
    }
  }
  return null;
}

/** نشانی otpauth برای ساخت QR در برنامه‌ی احراز هویت. */
export function otpauthUrl(
  secret: string,
  account: string,
  issuer = 'SamaLine',
): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

/** کاربر فارسی‌زبان ممکن است کد را با ارقام فارسی یا عربی تایپ کند. */
function toLatinDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}
