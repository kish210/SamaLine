import type { Question } from './types';

/**
 * اعتبارسنجی سمت کاربر.
 *
 * قواعد باید با `backend/src/public/answer-validator.ts` یکی بمانند؛ اینجا
 * فقط برای این است که کاربر پیش از رفتن به سرور خطا را ببیند. تصمیم نهایی
 * همیشه با سرور است، چون اعتبارسنجی مرورگر قابل دور زدن است.
 */
const MOBILE = /^09\d{9}$/;
const PHONE = /^0\d{2,4}\d{6,8}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function toLatinDigits(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, (digit) =>
    String(
      digit.charCodeAt(0) >= 0x06f0
        ? digit.charCodeAt(0) - 0x06f0
        : digit.charCodeAt(0) - 0x0660,
    ),
  );
}

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

const asText = (value: unknown) =>
  typeof value === 'string' ? value.trim() : String(value ?? '');

/** پیام خطای یک سوال، یا null اگر مشکلی نیست. */
export function validateAnswer(
  question: Question,
  value: unknown,
): string | null {
  if (question.type === 'static_text') return null;

  if (isEmpty(value)) {
    return question.required ? 'پاسخ این سوال الزامی است.' : null;
  }

  switch (question.type) {
    case 'number': {
      const num = Number(toLatinDigits(asText(value)));
      if (!Number.isFinite(num)) return 'فقط عدد وارد کنید.';
      const { min, max } = question.meta ?? {};
      if (typeof min === 'number' && num < min)
        return `عدد نباید کمتر از ${min} باشد.`;
      if (typeof max === 'number' && num > max)
        return `عدد نباید بیشتر از ${max} باشد.`;
      return null;
    }

    case 'mobile': {
      const digits = toLatinDigits(asText(value)).replace(/\D/g, '');
      return MOBILE.test(digits)
        ? null
        : 'شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود.';
    }

    case 'phone': {
      const digits = toLatinDigits(asText(value)).replace(/\D/g, '');
      return PHONE.test(digits) ? null : 'تلفن ثابت را با کد شهر وارد کنید.';
    }

    case 'email':
      return EMAIL.test(asText(value)) ? null : 'ایمیل معتبر نیست.';

    case 'url': {
      try {
        const parsed = new URL(asText(value));
        return parsed.protocol === 'http:' || parsed.protocol === 'https:'
          ? null
          : 'نشانی باید با http یا https شروع شود.';
      } catch {
        return 'نشانی معتبر نیست.';
      }
    }

    case 'date':
      return ISO_DATE.test(asText(value)) ? null : 'تاریخ معتبر نیست.';

    default:
      return null;
  }
}

/** اولین سوال دارای خطا در میان سوال‌های داده‌شده. */
export function firstInvalid(
  questions: Question[],
  answers: Record<string, unknown>,
): { questionId: string; message: string } | null {
  for (const question of questions) {
    const message = validateAnswer(question, answers[question.id]);
    if (message) return { questionId: question.id, message };
  }
  return null;
}
