import type { Answers } from './types';

const STORAGE_KEY = 'samaline.outbox';

export interface PendingSubmission {
  id: string;
  token: string;
  respondentKey?: string;
  answers: Answers;
  meta?: unknown;
  savedAt: number;
}

/**
 * صندوق خروجی آفلاین پاسخ‌دهنده.
 *
 * اگر هنگام ثبت پاسخ شبکه قطع باشد، پاسخ در مرورگر می‌ماند و با
 * برگشت اتصال خودکار فرستاده می‌شود. بدون این، کاربر پس از پر کردن
 * کل فرم پاسخش را از دست می‌داد.
 *
 * محدودیت: داده در localStorage همان مرورگر است؛ پاک کردن داده‌ی
 * سایت یا مرورگر دیگر یعنی از دست رفتن پاسخ ثبت‌نشده.
 */
function readAll(): PendingSubmission[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as PendingSubmission[]) : [];
  } catch {
    // حالت خصوصی مرورگر یا داده‌ی خراب
    return [];
  }
}

function writeAll(items: PendingSubmission[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // پر بودن حافظه نباید جریان پاسخ‌دهی را بشکند.
  }
}

export const offlineOutbox = {
  list: readAll,

  add(submission: Omit<PendingSubmission, 'id' | 'savedAt'>) {
    const items = readAll();
    items.push({
      ...submission,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      savedAt: Date.now(),
    });
    writeAll(items);
    return items.length;
  },

  remove(id: string) {
    writeAll(readAll().filter((item) => item.id !== id));
  },

  count() {
    return readAll().length;
  },
};

/** خطای شبکه (نه خطای منطقی سرور) که ارزش ذخیره‌ی آفلاین دارد. */
export function isNetworkError(error: unknown): boolean {
  if (!navigator.onLine) return true;
  const response = (error as { response?: unknown }).response;
  // axios وقتی پاسخی نگرفته باشد response ندارد.
  return response === undefined;
}
