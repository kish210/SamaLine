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
  /**
   * رنگ دوم گرادیان پس‌زمینه؛ خالی یعنی پس‌زمینه‌ی یکدست.
   * الگوی رایج فرم‌های فارسی، گرادیان ملایم پشت کارت سوال است.
   */
  gradientColor: string;
  /** زاویه‌ی گرادیان بر حسب درجه. */
  gradientAngle: number;
  /**
   * نمایش تک‌سوالی: هر گام یک سوال.
   * تمرکز پاسخ‌دهنده را بالا می‌برد و در موبایل خواناتر است.
   */
  oneQuestionPerStep: boolean;
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
  gradientColor: '',
  gradientAngle: 25,
  oneQuestionPerStep: false,
};

/** تم‌های آماده تا کاربر بدون دانستن کد رنگ هم ظاهر را عوض کند. */
/**
 * تم‌های آماده با نام فارسی.
 *
 * هر تم یک ترکیب کامل است (رنگ اصلی، پس‌زمینه، گرادیان، متن، گردی گوشه)
 * تا کاربر بدون دانستن کد رنگ هم بتواند ظاهر فرم را عوض کند.
 */
export const THEME_PRESETS: Record<string, Partial<FormTheme>> = {
  default: {},

  // ── روشن و ملایم ──
  aseman: {
    primaryColor: '#3ebfea',
    backgroundColor: '#ffffff',
    gradientColor: '#8ccbf0',
    textColor: '#334155',
    cornerRadius: 12,
  },
  oghyanus: {
    primaryColor: '#0369a1',
    backgroundColor: '#f0f9ff',
    gradientColor: '#bae6fd',
    textColor: '#0c4a6e',
  },
  daryā: {
    primaryColor: '#0e7490',
    backgroundColor: '#ecfeff',
    gradientColor: '#a5f3fc',
    textColor: '#164e63',
  },
  sahel: {
    primaryColor: '#0891b2',
    backgroundColor: '#fefce8',
    gradientColor: '#cffafe',
    textColor: '#164e63',
    cornerRadius: 18,
  },
  barf: {
    primaryColor: '#475569',
    backgroundColor: '#ffffff',
    surfaceColor: '#f8fafc',
    textColor: '#0f172a',
    cornerRadius: 8,
  },

  // ── سبز و طبیعت ──
  jangal: {
    primaryColor: '#047857',
    backgroundColor: '#f0fdf4',
    gradientColor: '#bbf7d0',
    textColor: '#064e3b',
  },
  bahar: {
    primaryColor: '#65a30d',
    backgroundColor: '#f7fee7',
    gradientColor: '#d9f99d',
    textColor: '#365314',
    cornerRadius: 20,
  },
  barg: {
    primaryColor: '#15803d',
    backgroundColor: '#ffffff',
    gradientColor: '#dcfce7',
    textColor: '#14532d',
  },
  firuze: {
    primaryColor: '#0d9488',
    backgroundColor: '#f0fdfa',
    gradientColor: '#99f6e4',
    textColor: '#134e4a',
    cornerRadius: 16,
  },

  // ── گرم ──
  ghorub: {
    primaryColor: '#c2410c',
    backgroundColor: '#fff7ed',
    gradientColor: '#fed7aa',
    textColor: '#7c2d12',
  },
  aftab: {
    primaryColor: '#d97706',
    backgroundColor: '#fffbeb',
    gradientColor: '#fde68a',
    textColor: '#78350f',
    cornerRadius: 18,
  },
  holu: {
    primaryColor: '#e11d48',
    backgroundColor: '#fff1f2',
    gradientColor: '#fecdd3',
    textColor: '#881337',
    cornerRadius: 20,
  },
  kavir: {
    primaryColor: '#a16207',
    backgroundColor: '#fefce8',
    gradientColor: '#fef08a',
    textColor: '#713f12',
  },
  choob: {
    primaryColor: '#78350f',
    backgroundColor: '#fef3c7',
    surfaceColor: '#fffbeb',
    textColor: '#451a03',
    cornerRadius: 6,
  },

  // ── بنفش و صورتی ──
  kahkeshan: {
    primaryColor: '#7c3aed',
    backgroundColor: '#faf5ff',
    gradientColor: '#ddd6fe',
    textColor: '#4c1d95',
    cornerRadius: 16,
  },
  makhmal: {
    primaryColor: '#9d174d',
    backgroundColor: '#fdf2f8',
    gradientColor: '#fbcfe8',
    textColor: '#500724',
    cornerRadius: 22,
  },
  abrang: {
    primaryColor: '#8b5cf6',
    backgroundColor: '#ffffff',
    gradientColor: '#e9d5ff',
    textColor: '#3b0764',
    cornerRadius: 24,
  },

  // ── خنثی و جدی ──
  khakestar: {
    primaryColor: '#374151',
    backgroundColor: '#f9fafb',
    surfaceColor: '#ffffff',
    textColor: '#111827',
    cornerRadius: 8,
  },
  mohandes: {
    primaryColor: '#1d4ed8',
    backgroundColor: '#f8fafc',
    surfaceColor: '#ffffff',
    textColor: '#1e293b',
    cornerRadius: 4,
  },
  sakhteman: {
    primaryColor: '#525252',
    backgroundColor: '#fafafa',
    surfaceColor: '#ffffff',
    textColor: '#171717',
    cornerRadius: 2,
  },
  madrese: {
    primaryColor: '#b91c1c',
    backgroundColor: '#fef2f2',
    gradientColor: '#fecaca',
    textColor: '#7f1d1d',
    cornerRadius: 10,
  },

  // ── تیره ──
  shab: {
    primaryColor: '#818cf8',
    backgroundColor: '#0f172a',
    surfaceColor: '#1e293b',
    textColor: '#e2e8f0',
    cornerRadius: 14,
  },
  tanha: {
    primaryColor: '#f59e0b',
    backgroundColor: '#18181b',
    surfaceColor: '#27272a',
    textColor: '#fafafa',
    cornerRadius: 16,
  },
  kuh: {
    primaryColor: '#38bdf8',
    backgroundColor: '#0c4a6e',
    surfaceColor: '#075985',
    textColor: '#e0f2fe',
    cornerRadius: 12,
  },
};

/**
 * نام‌های قدیمی تم‌ها.
 *
 * فرم‌های موجود مقادیری مثل `sky` را ذخیره کرده‌اند؛ بدون این نگاشت،
 * `resolveTheme` تم ناشناس را به پیش‌فرض برمی‌گرداند و ظاهر فرمِ منتشرشده
 * بی‌صدا عوض می‌شود.
 */
const LEGACY_PRESET_ALIASES: Record<string, string> = {
  sky: 'aseman',
  ocean: 'oghyanus',
  forest: 'jangal',
  sunset: 'ghorub',
  night: 'shab',
};

/**
 * نام فارسی هر تم آماده، برای نمایش در پنل.
 * کلیدها انگلیسی‌اند تا در تنظیمات ذخیره‌شده پایدار بمانند.
 */
export const THEME_PRESET_LABELS: Record<string, string> = {
  default: 'پیش‌فرض',
  aseman: 'آسمان',
  oghyanus: 'اقیانوس',
  daryā: 'دریا',
  sahel: 'ساحل',
  barf: 'برف',
  jangal: 'جنگل',
  bahar: 'بهار',
  barg: 'برگ',
  firuze: 'فیروزه',
  ghorub: 'غروب',
  aftab: 'آفتاب',
  holu: 'هلو',
  kavir: 'کویر',
  choob: 'چوب',
  kahkeshan: 'کهکشان',
  makhmal: 'مخمل',
  abrang: 'آبرنگ',
  khakestar: 'خاکستر',
  mohandes: 'مهندس',
  sakhteman: 'ساختمان',
  madrese: 'مدرسه',
  shab: 'شب',
  tanha: 'تنها',
  kuh: 'کوه',
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
  const resolvedName = LEGACY_PRESET_ALIASES[presetName] ?? presetName;
  const preset = THEME_PRESETS[resolvedName] ?? {};

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
    gradientColor: themeObject.gradientColor
      ? safeColor(themeObject.gradientColor, base.gradientColor ?? '')
      : (base.gradientColor ?? ''),
    gradientAngle: clampAngle(
      themeObject.gradientAngle,
      base.gradientAngle ?? 25,
    ),
    oneQuestionPerStep:
      typeof themeObject.oneQuestionPerStep === 'boolean'
        ? themeObject.oneQuestionPerStep
        : (base.oneQuestionPerStep ?? false),
  };
}

function clampAngle(value: unknown, fallback: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  // زاویه در بازه‌ی ۰ تا ۳۶۰ نگه داشته می‌شود.
  return ((Math.round(num) % 360) + 360) % 360;
}

function clampRadius(value: unknown, fallback: number): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(40, Math.max(0, Math.round(num)));
}
