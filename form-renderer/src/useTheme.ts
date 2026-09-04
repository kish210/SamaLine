import { useEffect } from 'react';
import type { FormTheme } from './types';

/**
 * اعمال ظاهر فرم روی صفحه.
 *
 * مقادیر به‌صورت متغیر CSS می‌نشینند، پس استایل‌ها یک منبع دارند و
 * تغییر تم نیازی به بازنویسی کلاس‌ها ندارد. مقادیر پیش از رسیدن به
 * اینجا سمت سرور پاک‌سازی شده‌اند.
 */
export function useTheme(theme: FormTheme | undefined) {
  useEffect(() => {
    if (!theme) return;
    const root = document.documentElement;

    root.style.setProperty('--form-primary', theme.primaryColor);
    root.style.setProperty('--form-bg', theme.backgroundColor);
    root.style.setProperty('--form-surface', theme.surfaceColor);
    root.style.setProperty('--form-ink', theme.textColor);
    root.style.setProperty('--form-radius', `${theme.cornerRadius}px`);
    root.style.setProperty('--form-font', theme.fontFamily);
    root.style.setProperty(
      '--form-bg-image',
      theme.backgroundImageUrl ? `url("${theme.backgroundImageUrl}")` : 'none',
    );
  }, [theme]);
}
