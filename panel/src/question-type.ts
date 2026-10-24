import type { Question, QuestionType } from './types';

/**
 * بازسازیِ پیکربندی سوال هنگام تغییر نوع.
 *
 * باگ: در ویرایشگر، عوض‌کردن نوع فقط `type` را عوض می‌کرد و `options`/`meta`ی
 * نوعِ قبلی را دست‌نخورده می‌گذاشت؛ پس تنظیماتِ ناسازگار (مثلاً `multiple` یا
 * فهرست گزینه‌ها روی یک سوال «عدد») روی سوال و در دیتابیس می‌ماند و رفتار
 * رندرر/گزارش را خراب می‌کرد، و تنظیمات نوعِ جدید هم مقداردهی اولیه نمی‌شد.
 *
 * قاعده‌ها:
 * - کلیدهای مستقل از نوع (`hidden`, `imageUrl`) همیشه حفظ می‌شوند.
 * - کلیدهای `meta` فقط اگر برای نوعِ جدید معنی داشته باشند حفظ می‌شوند؛ بقیه
 *   دور ریخته می‌شوند.
 * - مقدارهای پیش‌فرضِ لازمِ نوعِ جدید در صورت نبودن مقداردهی می‌شوند.
 * - `options` فقط میان نوع‌هایی که گزینه دارند حفظ می‌شود.
 * خروجی `dropped` فهرست چیزهایی است که دور ریخته می‌شوند تا UI بتواند پیش از
 * تغییر هشدار بدهد (هرگز بی‌صدا داده‌ی کاربر را نابود نکن).
 */

/** نوع‌هایی که از `question.options` استفاده می‌کنند. */
export const OPTION_TYPES: ReadonlySet<QuestionType> = new Set<QuestionType>([
  'multiple_choice',
  'dropdown',
  'image_choice',
  'emoji',
  'ranking',
]);

/** کلیدهای `meta` که برای هر نوع معنی دارند (جز کلیدهای مستقل از نوع). */
const TYPE_META_KEYS: Partial<Record<QuestionType, readonly string[]>> = {
  number: ['min', 'max', 'step'],
  rating: ['min', 'max', 'style', 'labels', 'showEmoji'],
  nps: ['labels'],
  slider: ['min', 'max', 'step', 'labels'],
  multiple_choice: ['multiple'],
  matrix: ['rows', 'columns'],
};

/** مقدارهای پیش‌فرضِ `meta` که هنگام سوئیچ به نوعِ جدید پر می‌شوند اگر نباشند. */
const TYPE_META_DEFAULTS: Partial<Record<QuestionType, Record<string, unknown>>> =
  {
    rating: { min: 1, max: 5 },
    slider: { min: 0, max: 100, step: 1 },
    matrix: { rows: ['ردیف ۱'], columns: ['۱', '۲', '۳', '۴', '۵'] },
  };

/** کلیدهایی از `meta` که به نوع وابسته نیستند و همیشه می‌مانند. */
const AGNOSTIC_META_KEYS = ['hidden', 'imageUrl'] as const;

export interface TypeChangeResult {
  /** patch برای ادغامِ کم‌عمق روی سوال. */
  patch: Partial<Question>;
  /** توضیحِ فارسیِ چیزهایی که دور ریخته می‌شوند (برای هشدار به کاربر). */
  dropped: string[];
}

/**
 * پیکربندیِ یک سوال را برای نوعِ تازه بازسازی می‌کند.
 * اگر نوع عوض نشده باشد، patch خالی و بدون دورریز برمی‌گردد.
 */
export function reconcileQuestionType(
  question: Pick<Question, 'type' | 'options' | 'meta'>,
  newType: QuestionType,
): TypeChangeResult {
  if (newType === question.type) {
    return { patch: {}, dropped: [] };
  }

  const oldMeta = (question.meta ?? {}) as Record<string, unknown>;
  const dropped: string[] = [];

  // ۱) کلیدهای مستقل از نوع را نگه دار.
  const nextMeta: Record<string, unknown> = {};
  for (const key of AGNOSTIC_META_KEYS) {
    if (oldMeta[key] !== undefined) nextMeta[key] = oldMeta[key];
  }

  // ۲) کلیدهای meta سازگار با نوعِ جدید را حفظ کن.
  const allowed = TYPE_META_KEYS[newType] ?? [];
  for (const key of allowed) {
    if (oldMeta[key] !== undefined) nextMeta[key] = oldMeta[key];
  }

  // ۳) بفهم چه کلیدهای meta ی معناداری دور ریخته می‌شوند.
  for (const key of Object.keys(oldMeta)) {
    if (
      !(AGNOSTIC_META_KEYS as readonly string[]).includes(key) &&
      !allowed.includes(key) &&
      oldMeta[key] !== undefined &&
      oldMeta[key] !== null &&
      oldMeta[key] !== ''
    ) {
      dropped.push(`تنظیم «${key}»`);
    }
  }

  // ۴) پیش‌فرض‌های نوعِ جدید را در صورت نبودن پر کن.
  const defaults = TYPE_META_DEFAULTS[newType] ?? {};
  for (const [key, value] of Object.entries(defaults)) {
    if (nextMeta[key] === undefined) nextMeta[key] = value;
  }

  // ۵) options را فقط میان نوع‌های گزینه‌دار حفظ کن.
  const keepsOptions = OPTION_TYPES.has(newType);
  const hadOptions = (question.options?.length ?? 0) > 0;
  let nextOptions: string[] | undefined;
  if (keepsOptions) {
    nextOptions = question.options ?? [];
  } else {
    nextOptions = undefined;
    if (hadOptions) dropped.push('فهرست گزینه‌ها');
  }

  return {
    patch: { type: newType, meta: nextMeta, options: nextOptions },
    dropped,
  };
}
