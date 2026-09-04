import type { FormQuestionNode } from '../forms/logic-types';

/** یک خطای اعتبارسنجی روی یک سوال مشخص. */
export interface AnswerError {
  questionId: string;
  message: string;
}

/** شماره‌ی موبایل ایران. */
const MOBILE = /^09\d{9}$/;
/** تلفن ثابت با کد شهر. */
const PHONE = /^0\d{2,4}\d{6,8}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * مقادیر پذیرفته‌شده‌ی سوال دو گزینه‌ای.
 *
 * رندرر «yes/no» می‌فرستد، ولی فرم‌های موجود و قوانین منطقی‌شان با
 * «بله/خیر» ساخته شده‌اند. سخت‌گیری روی یکی از این دو، فرم‌های قدیمی را
 * می‌شکند؛ پس هر دو نگارش پذیرفته می‌شوند.
 */
const BOOLEAN_VALUES = new Set(['yes', 'no', 'true', 'false', 'بله', 'خیر']);

/** ارقام فارسی و عربی به لاتین. */
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

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : String(value ?? '');
}

/** عنوان سوال برای پیام خطا؛ اگر نبود، شناسه. */
function label(question: FormQuestionNode): string {
  const title = typeof question.title === 'string' ? question.title.trim() : '';
  return title || question.id;
}

/**
 * اعتبارسنجی یک پاسخ بر اساس نوع سوال.
 *
 * فقط مقدار غیرخالی بررسی می‌شود؛ اجباری بودن جداگانه سنجیده می‌شود تا
 * پیام خطا دقیق‌تر باشد.
 */
function validateValue(
  question: FormQuestionNode,
  value: unknown,
): string | null {
  const name = label(question);

  switch (question.type) {
    case 'number': {
      const num = Number(toLatinDigits(asText(value)));
      if (!Number.isFinite(num)) return `«${name}» باید عدد باشد.`;
      const min = question.meta?.min;
      const max = question.meta?.max;
      if (typeof min === 'number' && num < min)
        return `«${name}» نباید کمتر از ${min} باشد.`;
      if (typeof max === 'number' && num > max)
        return `«${name}» نباید بیشتر از ${max} باشد.`;
      return null;
    }

    case 'mobile': {
      const digits = toLatinDigits(asText(value)).replace(/\D/g, '');
      return MOBILE.test(digits)
        ? null
        : `«${name}» باید شماره موبایل معتبر و ۱۱ رقمی باشد (مثل ۰۹۱۲۱۲۳۴۵۶۷).`;
    }

    case 'phone': {
      const digits = toLatinDigits(asText(value)).replace(/\D/g, '');
      return PHONE.test(digits)
        ? null
        : `«${name}» باید تلفن ثابت معتبر با کد شهر باشد.`;
    }

    case 'email':
      return EMAIL.test(asText(value)) ? null : `«${name}» ایمیل معتبر نیست.`;

    case 'url': {
      try {
        const parsed = new URL(asText(value));
        return parsed.protocol === 'http:' || parsed.protocol === 'https:'
          ? null
          : `«${name}» باید نشانی http یا https باشد.`;
      } catch {
        return `«${name}» نشانی معتبر نیست.`;
      }
    }

    case 'date':
      return ISO_DATE.test(asText(value))
        ? null
        : `«${name}» تاریخ معتبر نیست.`;

    case 'nps': {
      // بازه‌ی NPS تعریفی است و همیشه صفر تا ده.
      const num = Number(toLatinDigits(asText(value)));
      if (!Number.isFinite(num)) return `«${name}» باید عدد باشد.`;
      return num >= 0 && num <= 10
        ? null
        : `«${name}» باید بین ۰ تا ۱۰ باشد.`;
    }

    case 'rating':
    case 'slider': {
      const num = Number(toLatinDigits(asText(value)));
      if (!Number.isFinite(num)) return `«${name}» باید عدد باشد.`;

      /*
       * بازه فقط وقتی بررسی می‌شود که خودِ سوال آن را تعریف کرده باشد.
       *
       * فرض یک بازه‌ی پیش‌فرض (مثلا ۱ تا ۵) حدس است و پاسخ‌های معتبرِ
       * فرم‌های موجود را که با بازه‌ی دیگری ساخته شده‌اند رد می‌کند.
       */
      const min = question.meta?.min;
      const max = question.meta?.max;
      if (typeof min === 'number' && num < min)
        return `«${name}» نباید کمتر از ${min} باشد.`;
      if (typeof max === 'number' && num > max)
        return `«${name}» نباید بیشتر از ${max} باشد.`;
      return null;
    }

    case 'boolean':
      return BOOLEAN_VALUES.has(asText(value))
        ? null
        : `پاسخ «${name}» معتبر نیست.`;

    case 'multiple_choice':
    case 'dropdown':
    case 'image_choice':
    case 'emoji': {
      const options = question.options as string[] | undefined;
      // سوال بدون فهرست گزینه، چیزی برای بررسی ندارد.
      if (!Array.isArray(options) || options.length === 0) return null;

      const picked = Array.isArray(value) ? value : [value];
      const unknown = picked
        .map((item) => asText(item))
        .filter((item) => item !== '' && !options.includes(item));

      return unknown.length === 0
        ? null
        : `گزینه‌ی انتخاب‌شده برای «${name}» در فهرست نیست.`;
    }

    default:
      return null;
  }
}

/**
 * اعتبارسنجی پاسخ‌های یک فرم.
 *
 * فقط سوال‌هایی بررسی می‌شوند که واقعا به پاسخ‌دهنده نشان داده شده‌اند؛
 * سوالی که با منطق شرطی پنهان بوده نباید اجباری شمرده شود.
 *
 * این بررسی عمدا سمت سرور است: اعتبارسنجی مرورگر با یک درخواست مستقیم به
 * API کاملا دور زده می‌شود.
 */
export function validateAnswers(
  questions: FormQuestionNode[],
  answers: Record<string, unknown>,
  visibleIds: Set<string>,
): AnswerError[] {
  const errors: AnswerError[] = [];

  for (const question of questions) {
    if (!visibleIds.has(question.id)) continue;
    // متن ثابت سوال نیست و پاسخی نمی‌گیرد.
    if (question.type === 'static_text') continue;

    const value = answers[question.id];

    if (isEmpty(value)) {
      if (question.required) {
        errors.push({
          questionId: question.id,
          message: `پاسخ «${label(question)}» الزامی است.`,
        });
      }
      continue;
    }

    const message = validateValue(question, value);
    if (message) errors.push({ questionId: question.id, message });
  }

  return errors;
}
