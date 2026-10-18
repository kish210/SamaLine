import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';

const RELOAD_FLAG = 'samaline.chunk-reload';

/**
 * بارگذاری تنبل یک صفحه‌ی پنل.
 *
 * هر صفحه بسته‌ی جاوااسکریپت خودش را دارد تا ورود اول سبک بماند. پس از
 * به‌روزرسانی سرور، زبانه‌ای که از قبل باز مانده نام فایل‌های قدیمی را
 * می‌خواهد که دیگر وجود ندارند؛ به‌جای صفحه‌ی خراب، یک بار خودکار
 * بارگذاری مجدد می‌شود تا نسخه‌ی تازه گرفته شود.
 */
export function lazyPage<T extends ComponentType<object>>(
  load: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      const module = await load();
      sessionStorageSafe.remove(RELOAD_FLAG);
      return module;
    } catch (error) {
      if (!sessionStorageSafe.get(RELOAD_FLAG)) {
        sessionStorageSafe.set(RELOAD_FLAG, '1');
        window.location.reload();
        // تا بارگذاری مجدد، چیزی نمایش داده نمی‌شود.
        return new Promise<{ default: T }>(() => undefined);
      }
      throw error;
    }
  });
}

/** قاب انتظار صفحه، داخل پوسته‌ی پنل (سایدبار و تاپ‌بار سر جایشان می‌مانند). */
export function PageFallback({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="page page-loading">در حال بارگذاری…</div>}>
      {children}
    </Suspense>
  );
}

const sessionStorageSafe = {
  get(key: string) {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      sessionStorage.setItem(key, value);
    } catch {
      // بدون ذخیره‌سازی، فقط بارگذاری مجدد خودکار از دست می‌رود.
    }
  },
  remove(key: string) {
    try {
      sessionStorage.removeItem(key);
    } catch {
      // بی‌اهمیت
    }
  },
};
