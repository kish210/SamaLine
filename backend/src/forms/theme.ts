/** تنظیمات ظاهری فرم که به رندرر فرستاده می‌شود. */
export interface FormTheme {
  /** رنگ اصلی دکمه‌ها و تاکیدها. */
  primaryColor: string;
  /** رنگ پس‌زمینه‌ی صفحه. */
  backgroundColor: string;
  /** رنگ کارت فرم. */
  surfaceColor: string;
  /** رنگ متن. */
  textColor: string;
  /** گردی گوشه‌ها بر حسب پیکسل. */
  cornerRadius: number;
  /** نشانی لوگو؛ خالی یعنی بدون لوگو. */
  logoUrl: string;
  /** تصویر پس‌زمینه‌ی صفحه. */
  backgroundImageUrl: string;
  /** خانواده‌ی قلم. */
  fontFamily: string;
}

export const DEFAULT_THEME: FormTheme = {
  primaryColor: '#111827',
  backgroundColor: '#f8fafc',
  surfaceColor: '#ffffff',
  textColor: '#111827',
  cornerRadius: 14,
  logoUrl: '',
  backgroundImageUrl: '',
  fontFamily: 'Vazirmatn, Tahoma, sans-serif',
};

/** تم‌های آماده تا کاربر بدون دانستن کد رنگ هم ظاهر را عوض کند. */
export const THEME_PRESETS: Record<string, Partial<FormTheme>> = {
  default: {},
  ocean: {
    primaryColor: '#0369a1',
    backgroundColor: '#f0f9ff',
    textColor: '#0c4a6e',
  },
  forest: {
    primaryColor: '#047857',
    backgroundColor: '#f0fdf4',
    textColor: '#064e3b',
  },
  sunset: {
    primaryColor: '#c2410c',
    backgroundColor: '#fff7ed',
    textColor: '#7c2d12',
  },
  night: {
    primaryColor: '#818cf8',
    backgroundColor: '#0f172a',
    surfaceColor: '#1e293b',
    textColor: '#e2e8f0',
  },
};

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** فقط نشانی http(s) یا data:image پذیرفته می‌شود. */
function safeUrl(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return '';
  const url = value.trim();

  if (url.startsWith('data:image/')) return url;
  try {
    const parsed = new URL(url);
    // `javascript:` و مانند آن نباید به صفحه‌ی پاسخ‌دهنده برسد.
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
      ? url
      : '';
  } catch {
    return '';
  }
}

function safeColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX_COLOR.test(value.trim())
    ? value.trim()
    : fallback;
}

/**
 * ساخت تم نهایی از تنظیمات فرم.
 *
 * ورودی کاربر پاک‌سازی می‌شود چون این مقادیر مستقیم در style صفحه‌ی
 * پاسخ‌دهنده می‌نشینند؛ رنگ نامعتبر یا نشانی `javascript:` نباید عبور کند.
 */
export function resolveTheme(settings: Record<string, unknown>): FormTheme {
  const raw = (settings.theme ?? {}) as Record<string, unknown> | string;

  // سازگاری با داده‌ی قدیمی که theme را رشته ذخیره می‌کرد.
  const themeObject = typeof raw === 'string' ? { preset: raw } : raw;
  const presetName =
    typeof themeObject.preset === 'string' ? themeObject.preset : 'default';
  const preset = THEME_PRESETS[presetName] ?? {};

  const base = { ...DEFAULT_THEME, ...preset };

  return {
    primaryColor: safeColor(themeObject.primaryColor, base.primaryColor),
    backgroundColor: safeColor(
      themeObject.backgroundColor,
      base.backgroundColor,
    ),
    surfaceColor: safeColor(themeObject.surfaceColor, base.surfaceColor),
    textColor: safeColor(themeObject.textColor, base.textColor),
    cornerRadius: clampRadius(themeObject.cornerRadius, base.cornerRadius),
    logoUrl: safeUrl(themeObject.logoUrl),
    backgroundImageUrl: safeUrl(themeObject.backgroundImageUrl),
    fontFamily:
      typeof themeObject.fontFamily === 'string' &&
      themeObject.fontFamily.trim()
        ? themeObject.fontFamily.trim().slice(0, 120)
        : base.fontFamily,
  };
}

function clampRadius(value: unknown, fallback: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(40, Math.max(0, Math.round(num)));
}
