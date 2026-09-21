import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * در توسعه، درخواست‌های نسبی `/api` و `/uploads` به بک‌اند روی ۳۰۰۰ پراکسی
 * می‌شوند.
 *
 * این‌طوری نشانی API در کد نسبی می‌ماند (`/api/v1`) و همان بسته‌ای که در dev
 * کار می‌کند، در production هم بی‌تغییر روی همان دامنه کار می‌کند. پیش از این
 * پیش‌فرضِ `http://localhost:3000` در build production جا می‌ماند و فرم روی
 * سرور «خطا در ارتباط با سرور» می‌داد چون مرورگرِ کاربر سراغ لوکال‌هاست خودش
 * می‌رفت.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/uploads': 'http://localhost:3000',
    },
  },
})
