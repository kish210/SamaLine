/**
 * نشانی پایه‌ی فرم‌های عمومی.
 *
 * در استقرار تک‌پورتی، فرم از همان دامنه‌ی پنل سرو می‌شود (پنل زیر `/panel`
 * و فرم روی ریشه). پس اگر `VITE_RENDERER_URL` تنظیم نشده باشد، ریشه‌ی همین
 * دامنه درست است — نه `localhost:5173` که فقط در توسعه معنا دارد.
 */
function resolveBase(): string {
  const configured = import.meta.env.VITE_RENDERER_URL;
  if (configured) return configured.replace(/\/$/, "");

  // در توسعه، پنل و رندرر روی دو پورت جدا بالا می‌آیند.
  if (import.meta.env.DEV) return "http://localhost:5173";

  return window.location.origin;
}

export const RENDERER_BASE = resolveBase();

/** نشانی کامل یک فرم منتشرشده. */
export function formUrl(tokenOrSlug: string): string {
  return `${RENDERER_BASE}/f/${tokenOrSlug}`;
}

/** نشانی کامل یک منوی QR. */
export function menuUrl(slug: string): string {
  return `${RENDERER_BASE}/m/${slug}`;
}
