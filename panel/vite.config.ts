import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * پنل زیر مسیر `/panel` سرو می‌شود (استقرار تک‌پورتی).
 *
 * بدون تنظیم base، فایل‌های ساخته‌شده با نشانی `/assets/...` صدا زده
 * می‌شوند و روی سرور به فرم‌رندرر می‌خورند نه پنل — نتیجه صفحه‌ی سفید و
 * ۴۰۴. با BASE_PATH می‌شود در استقرارهای دیگر عوضش کرد.
 */
export default defineConfig({
  base: process.env.BASE_PATH ?? '/panel/',
  plugins: [react()],
  /*
   * در توسعه، `/api` و `/uploads` نسبی به بک‌اند روی ۳۰۰۰ پراکسی می‌شوند تا
   * نشانی API در کد نسبی بماند و همان بسته در production بی‌تغییر کار کند.
   */
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/uploads': 'http://localhost:3000',
    },
  },
});
