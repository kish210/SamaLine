/**
 * شمارش تلاش ناموفق و قفل موقت — در حافظه‌ی همین فرایند.
 *
 * برای جلوگیری از حدس زدن رمز با تلاش پشت‌سرهم. سامانه تک‌نمونه‌ای اجرا
 * می‌شود، پس حافظه کافی است و به Redis یا جدول تازه نیازی نیست؛ پاک شدنش
 * با ری‌استارت هم فقط یعنی شمارش از نو شروع می‌شود.
 */
export class AttemptLimiter {
  private readonly records = new Map<
    string,
    { count: number; firstAt: number; lockedUntil: number }
  >();

  constructor(
    private readonly maxFailures: number,
    private readonly windowMs: number,
    private readonly lockMs: number,
    private readonly maxKeys = 10_000,
  ) {}

  /** آیا این کلید همین حالا قفل است؟ */
  isLocked(key: string, now = Date.now()): boolean {
    const record = this.records.get(key);
    return Boolean(record && record.lockedUntil > now);
  }

  /** ثبت یک شکست؛ با رسیدن به سقف، کلید قفل می‌شود. */
  fail(key: string, now = Date.now()): void {
    let record = this.records.get(key);
    if (!record || now - record.firstAt > this.windowMs) {
      record = { count: 0, firstAt: now, lockedUntil: 0 };
    }
    record.count += 1;
    if (record.count >= this.maxFailures) {
      record.lockedUntil = now + this.lockMs;
      record.count = 0;
      record.firstAt = now;
    }
    this.records.set(key, record);
    this.evictIfFull(now);
  }

  /** موفقیت، شمارش را پاک می‌کند. */
  succeed(key: string): void {
    this.records.delete(key);
  }

  /** جلوگیری از رشد بی‌پایان حافظه با کلیدهای ساختگی. */
  private evictIfFull(now: number) {
    if (this.records.size <= this.maxKeys) return;
    for (const [key, record] of this.records) {
      if (record.lockedUntil <= now) this.records.delete(key);
      if (this.records.size <= this.maxKeys) return;
    }
  }
}
