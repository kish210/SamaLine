/**
 * تم‌های آماده، هم‌نام با `backend/src/forms/theme.ts`.
 *
 * پنل باید بتواند بندانگشتیِ هر تم را بدون رفت‌وبرگشت با سرور بکشد، پس
 * رنگ‌ها اینجا هم هستند. کلیدها باید دقیقا با بک‌اند یکی بمانند، وگرنه
 * بندانگشتی چیزی را نشان می‌دهد که فرم واقعی نیست.
 */
export interface ThemePreset {
  key: string;
  label: string;
  primaryColor: string;
  backgroundColor: string;
  gradientColor?: string;
  surfaceColor?: string;
  textColor: string;
  cornerRadius?: number;
}

export const THEME_PRESETS: ThemePreset[] = [
  { key: 'default', label: 'پیش‌فرض', primaryColor: '#111827', backgroundColor: '#f8fafc', surfaceColor: '#ffffff', textColor: '#111827', cornerRadius: 14 },

  { key: 'aseman', label: 'آسمان', primaryColor: '#3ebfea', backgroundColor: '#ffffff', gradientColor: '#8ccbf0', textColor: '#334155', cornerRadius: 12 },
  { key: 'oghyanus', label: 'اقیانوس', primaryColor: '#0369a1', backgroundColor: '#f0f9ff', gradientColor: '#bae6fd', textColor: '#0c4a6e' },
  { key: 'daryā', label: 'دریا', primaryColor: '#0e7490', backgroundColor: '#ecfeff', gradientColor: '#a5f3fc', textColor: '#164e63' },
  { key: 'sahel', label: 'ساحل', primaryColor: '#0891b2', backgroundColor: '#fefce8', gradientColor: '#cffafe', textColor: '#164e63', cornerRadius: 18 },
  { key: 'barf', label: 'برف', primaryColor: '#475569', backgroundColor: '#ffffff', surfaceColor: '#f8fafc', textColor: '#0f172a', cornerRadius: 8 },

  { key: 'jangal', label: 'جنگل', primaryColor: '#047857', backgroundColor: '#f0fdf4', gradientColor: '#bbf7d0', textColor: '#064e3b' },
  { key: 'bahar', label: 'بهار', primaryColor: '#65a30d', backgroundColor: '#f7fee7', gradientColor: '#d9f99d', textColor: '#365314', cornerRadius: 20 },
  { key: 'barg', label: 'برگ', primaryColor: '#15803d', backgroundColor: '#ffffff', gradientColor: '#dcfce7', textColor: '#14532d' },
  { key: 'firuze', label: 'فیروزه', primaryColor: '#0d9488', backgroundColor: '#f0fdfa', gradientColor: '#99f6e4', textColor: '#134e4a', cornerRadius: 16 },

  { key: 'ghorub', label: 'غروب', primaryColor: '#c2410c', backgroundColor: '#fff7ed', gradientColor: '#fed7aa', textColor: '#7c2d12' },
  { key: 'aftab', label: 'آفتاب', primaryColor: '#d97706', backgroundColor: '#fffbeb', gradientColor: '#fde68a', textColor: '#78350f', cornerRadius: 18 },
  { key: 'holu', label: 'هلو', primaryColor: '#e11d48', backgroundColor: '#fff1f2', gradientColor: '#fecdd3', textColor: '#881337', cornerRadius: 20 },
  { key: 'kavir', label: 'کویر', primaryColor: '#a16207', backgroundColor: '#fefce8', gradientColor: '#fef08a', textColor: '#713f12' },
  { key: 'choob', label: 'چوب', primaryColor: '#78350f', backgroundColor: '#fef3c7', surfaceColor: '#fffbeb', textColor: '#451a03', cornerRadius: 6 },

  { key: 'kahkeshan', label: 'کهکشان', primaryColor: '#7c3aed', backgroundColor: '#faf5ff', gradientColor: '#ddd6fe', textColor: '#4c1d95', cornerRadius: 16 },
  { key: 'makhmal', label: 'مخمل', primaryColor: '#9d174d', backgroundColor: '#fdf2f8', gradientColor: '#fbcfe8', textColor: '#500724', cornerRadius: 22 },
  { key: 'abrang', label: 'آبرنگ', primaryColor: '#8b5cf6', backgroundColor: '#ffffff', gradientColor: '#e9d5ff', textColor: '#3b0764', cornerRadius: 24 },

  { key: 'khakestar', label: 'خاکستر', primaryColor: '#374151', backgroundColor: '#f9fafb', surfaceColor: '#ffffff', textColor: '#111827', cornerRadius: 8 },
  { key: 'mohandes', label: 'مهندس', primaryColor: '#1d4ed8', backgroundColor: '#f8fafc', surfaceColor: '#ffffff', textColor: '#1e293b', cornerRadius: 4 },
  { key: 'sakhteman', label: 'ساختمان', primaryColor: '#525252', backgroundColor: '#fafafa', surfaceColor: '#ffffff', textColor: '#171717', cornerRadius: 2 },
  { key: 'madrese', label: 'مدرسه', primaryColor: '#b91c1c', backgroundColor: '#fef2f2', gradientColor: '#fecaca', textColor: '#7f1d1d', cornerRadius: 10 },

  { key: 'shab', label: 'شب', primaryColor: '#818cf8', backgroundColor: '#0f172a', surfaceColor: '#1e293b', textColor: '#e2e8f0', cornerRadius: 14 },
  { key: 'tanha', label: 'تنها', primaryColor: '#f59e0b', backgroundColor: '#18181b', surfaceColor: '#27272a', textColor: '#fafafa', cornerRadius: 16 },
  { key: 'kuh', label: 'کوه', primaryColor: '#38bdf8', backgroundColor: '#0c4a6e', surfaceColor: '#075985', textColor: '#e0f2fe', cornerRadius: 12 },
];

/** پس‌زمینه‌ی بندانگشتی؛ اگر تم گرادیان دارد، همان گرادیان کشیده می‌شود. */
export function presetBackground(preset: ThemePreset): string {
  return preset.gradientColor
    ? `linear-gradient(160deg, ${preset.backgroundColor} 20%, ${preset.gradientColor} 100%)`
    : preset.backgroundColor;
}

/**
 * نام‌های قدیمی تم‌ها؛ باید با `LEGACY_PRESET_ALIASES` در بک‌اند یکی بماند.
 *
 * فرم‌های موجود مقادیری مثل `sky` را ذخیره کرده‌اند. بک‌اند این‌ها را نگاشت
 * می‌کند، ولی پنل هم باید همین کار را بکند وگرنه هیچ کارتی «انتخاب‌شده»
 * نشان داده نمی‌شود و کاربر فکر می‌کند فرمش تم ندارد.
 */
const LEGACY_ALIASES: Record<string, string> = {
  sky: 'aseman',
  ocean: 'oghyanus',
  forest: 'jangal',
  sunset: 'ghorub',
  night: 'shab',
};

/** نام تم ذخیره‌شده را به کلید فعلی تبدیل می‌کند. */
export function canonicalPreset(name: string): string {
  return LEGACY_ALIASES[name] ?? name;
}
