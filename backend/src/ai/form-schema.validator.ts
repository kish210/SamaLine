import { ALL_QUESTION_TYPES } from '../types/form-types';

/** نام‌های رایجِ نوعِ سوال که مدل‌ها می‌دهند → نوعِ واقعیِ سامانه. */
const TYPE_ALIASES: Record<string, string> = {
  text: 'short_text',
  string: 'short_text',
  input: 'short_text',
  short_answer: 'short_text',
  textarea: 'long_text',
  paragraph: 'long_text',
  long_answer: 'long_text',
  radio: 'multiple_choice',
  single_choice: 'multiple_choice',
  choice: 'multiple_choice',
  checkbox: 'multiple_choice',
  checkboxes: 'multiple_choice',
  select: 'dropdown',
  yes_no: 'boolean',
  yesno: 'boolean',
  scale: 'rating',
  stars: 'rating',
  tel: 'phone',
  integer: 'number',
};

export interface SchemaValidationResult {
  valid: boolean;
  errors: string[];
  /** ساختار پاک‌سازی‌شده و قابل بارگذاری در Builder. */
  normalized: {
    title: string;
    language: string;
    pages: Array<{
      id: string;
      title: string;
      questions: Array<Record<string, unknown>>;
    }>;
  } | null;
}

/**
 * اعتبارسنجی خروجی مدل هوش مصنوعی پیش از بارگذاری در فرم‌ساز.
 *
 * سند (بند ۱۰) صراحتا خواسته خروجی مدل با schema اعتبارسنجی شود و
 * مدل هرگز دسترسی مستقیم نداشته باشد؛ این تابع همان دروازه است.
 */
export function validateGeneratedForm(raw: unknown): SchemaValidationResult {
  const errors: string[] = [];

  if (typeof raw !== 'object' || raw === null) {
    return {
      valid: false,
      errors: ['خروجی مدل یک شیء نیست'],
      normalized: null,
    };
  }

  const input = raw as Record<string, unknown>;
  const title =
    typeof input.title === 'string' && input.title.trim()
      ? input.title.trim()
      : '';
  if (!title) errors.push('عنوان فرم موجود نیست');

  const language = typeof input.language === 'string' ? input.language : 'fa';

  const rawPages = Array.isArray(input.pages) ? input.pages : null;
  if (!rawPages?.length) errors.push('فرم هیچ صفحه‌ای ندارد');

  const seenQuestionIds = new Set<string>();
  const pages: SchemaValidationResult['normalized'] extends null
    ? never
    : NonNullable<SchemaValidationResult['normalized']>['pages'] = [];

  (rawPages ?? []).forEach((rawPage, pageIndex) => {
    if (typeof rawPage !== 'object' || rawPage === null) {
      errors.push(`صفحه ${pageIndex + 1} معتبر نیست`);
      return;
    }
    const page = rawPage as Record<string, unknown>;
    const pageId =
      typeof page.id === 'string' && page.id.trim()
        ? page.id.trim()
        : `page_${pageIndex + 1}`;

    const rawQuestions = Array.isArray(page.questions) ? page.questions : [];
    if (!rawQuestions.length) {
      errors.push(`صفحه ${pageId} هیچ سوالی ندارد`);
    }

    const questions: Array<Record<string, unknown>> = [];
    rawQuestions.forEach((rawQuestion, questionIndex) => {
      if (typeof rawQuestion !== 'object' || rawQuestion === null) {
        errors.push(`سوال ${questionIndex + 1} صفحه ${pageId} معتبر نیست`);
        return;
      }
      const question = rawQuestion as Record<string, unknown>;
      const id =
        typeof question.id === 'string' && question.id.trim()
          ? question.id.trim()
          : `${pageId}_q${questionIndex + 1}`;

      if (seenQuestionIds.has(id)) {
        errors.push(`شناسه سوال «${id}» تکراری است`);
        return;
      }
      seenQuestionIds.add(id);

      // مدل‌ها نام‌های رایجِ فرم‌های وب را می‌دهند (text، radio، checkbox …)؛
      // به‌جای ردِ کلِ فرم، به نوعِ معادلِ سامانه برگردانده می‌شوند.
      const rawType =
        typeof question.type === 'string' ? question.type.trim().toLowerCase() : '';
      const type = TYPE_ALIASES[rawType] ?? rawType;
      if (!(ALL_QUESTION_TYPES as readonly string[]).includes(type)) {
        errors.push(
          `نوع سوال «${type || 'نامشخص'}» در سامانه پشتیبانی نمی‌شود`,
        );
        return;
      }

      const questionTitle =
        typeof question.title === 'string' && question.title.trim()
          ? question.title.trim()
          : '';
      if (!questionTitle) {
        errors.push(`سوال «${id}» عنوان ندارد`);
        return;
      }

      questions.push({
        id,
        type,
        title: questionTitle,
        ...(typeof question.description === 'string'
          ? { description: question.description }
          : {}),
        ...(typeof question.required === 'boolean'
          ? { required: question.required }
          : {}),
        ...(Array.isArray(question.options)
          ? { options: question.options.map((o) => String(o)) }
          : {}),
      });
    });

    pages.push({
      id: pageId,
      title:
        typeof page.title === 'string' && page.title.trim()
          ? page.title.trim()
          : `صفحه ${pageIndex + 1}`,
      questions,
    });
  });

  const valid = errors.length === 0;
  return {
    valid,
    errors,
    normalized: valid ? { title, language, pages } : null,
  };
}
