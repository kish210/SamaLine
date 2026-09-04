import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const PREFIX = 'enc:v1:';

/**
 * رمزنگاری راز در سطح ستون.
 *
 * کلیدهای API سرویس‌های بیرونی خام در دیتابیس می‌نشستند؛ یک نسخه‌ی
 * پشتیبان لو رفته یعنی دسترسی به CRM مشتری. اینجا با AES-256-GCM
 * رمز می‌شوند (GCM چون هم محرمانگی می‌دهد هم تشخیص دستکاری).
 *
 * کلید از `SECRET_ENCRYPTION_KEY` مشتق می‌شود. اگر تنظیم نشده باشد،
 * از JWT_SECRET استفاده می‌شود تا نصب پیش‌فرض هم کار کند — ولی برای
 * محیط واقعی باید کلید جدا تعریف شود.
 */
function encryptionKey(): Buffer {
  const secret =
    process.env.SECRET_ENCRYPTION_KEY ?? process.env.JWT_SECRET ?? 'change-me';
  // نمک ثابت است چون باید بتوانیم همان کلید را دوباره بسازیم؛ قدرت از
  // خودِ راز می‌آید نه از نمک.
  return scryptSync(secret, 'samaline-secret-box', 32);
}

/** آیا این مقدار قبلا رمز شده است؟ */
export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}

export function encryptSecret(plain: string): string {
  if (!plain) return plain;
  // رمزنگاری دوباره‌ی یک مقدار رمزشده، آن را خراب می‌کند.
  if (isEncrypted(plain)) return plain;

  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plain, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return (
    PREFIX +
    [
      iv.toString('base64'),
      tag.toString('base64'),
      encrypted.toString('base64'),
    ].join('.')
  );
}

/**
 * رمزگشایی. مقدار رمزنشده دست‌نخورده برمی‌گردد تا داده‌ی قدیمی که
 * پیش از این قابلیت ذخیره شده هنوز کار کند.
 */
export function decryptSecret(value: string): string {
  if (!value || !isEncrypted(value)) return value;

  const [ivPart, tagPart, dataPart] = value.slice(PREFIX.length).split('.');
  if (!ivPart || !tagPart || !dataPart) {
    throw new Error('مقدار رمزشده ساختار معتبری ندارد');
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    encryptionKey(),
    Buffer.from(ivPart, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(tagPart, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(dataPart, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

/** رمزنگاری همه‌ی مقادیر یک شیء هدر. */
export function encryptHeaders(headers: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key, encryptSecret(value)]),
  );
}

export function decryptHeaders(headers: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key, decryptSecret(value)]),
  );
}
