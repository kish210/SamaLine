/** نشانی‌هایی که نباید به‌عنوان لینک اختصاصی گرفته شوند. */
const RESERVED_SLUGS = new Set([
  'api',
  'admin',
  'panel',
  'login',
  'logout',
  'register',
  'portal',
  'public',
  'static',
  'assets',
  'f',
  'form',
  'forms',
  'new',
  'edit',
  'preview',
]);

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export interface SlugValidation {
  valid: boolean;
  reason: string | null;
  normalized: string;
}

/**
 * اعتبارسنجی و یکسان‌سازی لینک اختصاصی.
 *
 * فقط حروف کوچک لاتین، رقم و خط تیره پذیرفته می‌شود: نشانی باید در
 * پیامک و بنر چاپی بدون درصدگذاری (percent-encoding) خوانا بماند.
 */
export function validateSlug(input: string): SlugValidation {
  const normalized = input.trim().toLowerCase();

  if (!normalized) {
    return { valid: false, reason: 'نشانی خالی است', normalized };
  }
  if (normalized.length < 3) {
    return {
      valid: false,
      reason: 'نشانی باید حداقل ۳ نویسه باشد',
      normalized,
    };
  }
  if (normalized.length > 60) {
    return {
      valid: false,
      reason: 'نشانی نباید بیش از ۶۰ نویسه باشد',
      normalized,
    };
  }
  if (!SLUG_PATTERN.test(normalized)) {
    return {
      valid: false,
      reason:
        'فقط حروف کوچک انگلیسی، رقم و خط تیره مجاز است و نباید با خط تیره شروع یا تمام شود',
      normalized,
    };
  }
  if (RESERVED_SLUGS.has(normalized)) {
    return { valid: false, reason: 'این نشانی رزرو شده است', normalized };
  }

  return { valid: true, reason: null, normalized };
}

/** پیشنهاد نشانی از روی عنوان فارسی فرم. */
export function suggestSlug(title: string, fallback: string): string {
  const latin = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  // عنوان فارسی پس از حذف نویسه‌های غیرلاتین چیزی باقی نمی‌گذارد،
  // پس به شناسه‌ی یکتا برمی‌گردیم.
  return latin.length >= 3 ? latin.slice(0, 60) : fallback;
}
