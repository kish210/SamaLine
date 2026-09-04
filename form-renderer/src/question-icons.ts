/**
 * مسیر SVG آیکن هر نوع سوال.
 *
 * جدا از کامپوننت نگه داشته شده تا فایل کامپوننت فقط کامپوننت صادر کند
 * (شرط درست کار کردن Fast Refresh).
 */
export const ICON_PATHS: Record<string, string> = {
  mobile: 'M7 2h10v20H7z M11 18h2',
  phone: 'M6 3l4 5-2 2a12 12 0 006 6l2-2 5 4-3 3C11 21 3 13 3 6z',
  email: 'M2 5h20v14H2z M2 6l10 7 10-7',
  url: 'M9 15l6-6 M10 6l2-2a4 4 0 016 6l-2 2 M14 18l-2 2a4 4 0 01-6-6l2-2',
  number: 'M4 9h16 M4 15h16 M9 4l-2 16 M17 4l-2 16',
  date: 'M3 6h18v15H3z M3 10h18 M8 3v4 M16 3v4',
  long_text: 'M4 6h16 M4 11h16 M4 16h10',
  short_text: 'M4 8h16 M4 14h9',
  location: 'M12 22s7-6.4 7-12a7 7 0 10-14 0c0 5.6 7 12 7 12z M12 10h.01',
  file_upload: 'M12 17V5 M7 10l5-5 5 5 M4 19h16',
  camera: 'M3 7h4l2-2h6l2 2h4v13H3z M12 16a3.5 3.5 0 100-7 3.5 3.5 0 000 7z',
  audio_record:
    'M12 3a3 3 0 013 3v6a3 3 0 01-6 0V6a3 3 0 013-3z M5 11a7 7 0 0014 0 M12 18v3',
  signature: 'M3 18c4 0 4-10 8-10s4 8 8 4 M4 21h16',
};

/** آیا این نوع سوال آیکن دارد؟ برای تصمیم درباره‌ی چیدمان ورودی. */
export function hasIcon(type: string): boolean {
  return type in ICON_PATHS;
}
