/**
 * ظاهرهای آماده‌ی منوی QR.
 *
 * «قالب» در منو دو معنا دارد: محتوای آماده (بخش‌ها و اقلام، menu-templates.ts)
 * و ظاهرِ صفحه — همین فایل. ظاهر فقط یک کلید است که روی منو ذخیره می‌شود؛
 * رنگ‌های واقعی در CSSِ رندرر (`.menu-theme-<key>`) تعریف شده‌اند و اینجا فقط
 * برای پیش‌نمایشِ پنل تکرار می‌شوند. کلیدِ ناشناخته به «کلاسیک» برمی‌گردد.
 */
export interface MenuTheme {
  key: string;
  title: string;
  /** رنگ‌های پیش‌نمایش در پنل: زمینه، متن، تأکید. */
  bg: string;
  ink: string;
  accent: string;
}

export const DEFAULT_MENU_THEME = 'classic';

export const MENU_THEMES: MenuTheme[] = [
  { key: 'classic', title: 'کلاسیک روشن', bg: '#f8fafc', ink: '#111827', accent: '#111827' },
  { key: 'night', title: 'شب (تیره)', bg: '#0f172a', ink: '#f1f5f9', accent: '#38bdf8' },
  { key: 'gold', title: 'لوکس طلایی', bg: '#1a1410', ink: '#f5e9d0', accent: '#d4af37' },
  { key: 'cafe', title: 'کافه', bg: '#f3efe6', ink: '#3b2a1a', accent: '#8b5e34' },
  { key: 'garden', title: 'باغ (سبز)', bg: '#f0f7f1', ink: '#14361f', accent: '#2f855a' },
  { key: 'sea', title: 'دریا (آبی)', bg: '#eef6fb', ink: '#0c2d48', accent: '#0e7490' },
  { key: 'black-gold', title: 'مشکی طلایی', bg: '#0a0a0b', ink: '#f6edd8', accent: '#e7c66b' },
];

export function isMenuTheme(key: string): boolean {
  return MENU_THEMES.some((theme) => theme.key === key);
}
