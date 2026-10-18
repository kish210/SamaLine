/**
 * آیا توکنی که در `issuedAtSeconds` صادر شده، پس از تغییر رمز هنوز معتبر است؟
 *
 * `iat` توکن به ثانیه است؛ لحظه‌ی تغییر رمز هم به ثانیه گرد می‌شود تا توکن
 * تازه‌ای که در همان ثانیه برای خود کاربر صادر می‌شود رد نشود.
 */
export function issuedAfterPasswordChange(
  issuedAtSeconds: number | undefined,
  passwordChangedAt: Date | null,
): boolean {
  if (!passwordChangedAt) return true;
  if (typeof issuedAtSeconds !== 'number') return false;
  return issuedAtSeconds * 1000 >= passwordChangedAt.getTime();
}
