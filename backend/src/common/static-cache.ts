/**
 * سیاست کش فایل‌های ساخته‌شده.
 *
 * فایل‌های `assets/` نام هش‌دار دارند و محتوایشان هرگز عوض نمی‌شود، پس
 * مرورگر یک سال نگهشان می‌دارد. index.html و سرویس‌ورکر باید همیشه تازه
 * باشند؛ وگرنه پس از به‌روزرسانی، مرورگر نسخه‌ی قدیمی را اجرا می‌کرد.
 */
export function cacheControlFor(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  if (/\/assets\//.test(normalized)) {
    return 'public, max-age=31536000, immutable';
  }
  return 'no-cache';
}
