/** رکورد خام یک فرد در پاسخ سرویس بیرونی. */
export type ExternalRecord = Record<string, unknown>;

export interface MappedContact {
  fullName?: string;
  mobile?: string;
  email?: string;
  variables?: Record<string, unknown>;
}

/**
 * خواندن مقدار از مسیر نقطه‌ای: `user.profile.phone`.
 * برای پاسخ‌هایی که فیلدها را تو در تو می‌دهند.
 */
export function readPath(source: unknown, path: string): unknown {
  if (!path) return source;

  let current: unknown = source;
  for (const key of path.split('.')) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/**
 * آرایه‌ی افراد را از پاسخ بیرون می‌کشد.
 * پاسخ سرویس‌ها معمولا یا خودش آرایه است یا زیر کلیدی مثل data/items نشسته.
 */
export function extractItems(
  payload: unknown,
  itemsPath: string,
): { items: ExternalRecord[]; error: string | null } {
  const target = readPath(payload, itemsPath.trim());

  if (Array.isArray(target)) {
    const items = target.filter(
      (item): item is ExternalRecord =>
        typeof item === 'object' && item !== null && !Array.isArray(item),
    );
    return { items, error: null };
  }

  // راهنمای مشخص بهتر از «چیزی پیدا نشد» است.
  if (!itemsPath && target && typeof target === 'object') {
    const arrayKeys = Object.entries(target as Record<string, unknown>)
      .filter(([, value]) => Array.isArray(value))
      .map(([key]) => key);

    if (arrayKeys.length) {
      return {
        items: [],
        error: `پاسخ یک آرایه نیست. «مسیر آرایه» را روی یکی از این کلیدها بگذارید: ${arrayKeys.join('، ')}`,
      };
    }
  }

  return {
    items: [],
    error: itemsPath
      ? `در مسیر «${itemsPath}» آرایه‌ای پیدا نشد`
      : 'پاسخ سرویس یک آرایه نیست و مسیر آرایه هم تعیین نشده است',
  };
}

const asText = (value: unknown): string | undefined => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') return value.trim() || undefined;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return undefined;
};

/**
 * شماره‌ی موبایل ایرانی را به شکل `09xxxxxxxxx` یکسان می‌کند تا
 * تشخیص تکراری بین منابع مختلف درست کار کند.
 */
export function normalizeMobile(raw: unknown): string | undefined {
  const text = asText(raw);
  if (!text) return undefined;

  // ارقام فارسی و عربی به لاتین
  const latin = text.replace(/[۰-۹٠-٩]/g, (digit) => {
    const persian = '۰۱۲۳۴۵۶۷۸۹'.indexOf(digit);
    if (persian >= 0) return String(persian);
    return String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit));
  });

  const digits = latin.replace(/\D/g, '');
  if (!digits) return undefined;

  if (digits.startsWith('0098')) return `0${digits.slice(4)}`;
  if (digits.startsWith('98') && digits.length === 12) {
    return `0${digits.slice(2)}`;
  }
  if (digits.startsWith('9') && digits.length === 10) return `0${digits}`;
  return digits;
}

/**
 * یک رکورد بیرونی را با نگاشت کاربر به مخاطب سامانه تبدیل می‌کند.
 * کلیدهای نگاشت‌نشده به‌عنوان متغیر شخصی‌سازی نگه داشته می‌شوند.
 */
export function mapRecord(
  record: ExternalRecord,
  mapping: Record<string, string>,
): MappedContact {
  const fullName = asText(readPath(record, mapping.fullName ?? ''));
  const mobile = normalizeMobile(readPath(record, mapping.mobile ?? ''));
  const email = asText(readPath(record, mapping.email ?? ''))?.toLowerCase();

  const usedPaths = new Set(
    [mapping.fullName, mapping.mobile, mapping.email].filter(Boolean),
  );

  const variables: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (usedPaths.has(key)) continue;
    if (value === null || typeof value === 'object') continue;
    variables[key] = value;
  }

  return { fullName, mobile, email, variables };
}

export interface MappingResult {
  contacts: MappedContact[];
  /** رکوردهایی که نه موبایل داشتند نه ایمیل. */
  unusable: number;
}

export function mapRecords(
  records: ExternalRecord[],
  mapping: Record<string, string>,
): MappingResult {
  const contacts: MappedContact[] = [];
  let unusable = 0;

  for (const record of records) {
    const mapped = mapRecord(record, mapping);
    if (!mapped.mobile && !mapped.email) {
      unusable += 1;
      continue;
    }
    contacts.push(mapped);
  }

  return { contacts, unusable };
}
