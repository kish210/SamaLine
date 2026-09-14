/**
 * اپراتورهای شرط، با برچسب فارسی.
 *
 * ویرایشگر پرش و ویرایشگر نمایش هر دو از همین فهرست می‌خوانند تا برچسب یک
 * اپراتور در دو جای پنل دو چیز متفاوت نشود. ترتیب و مقدارها باید با
 * `LOGIC_OPERATORS` در بک‌اند یکی بماند؛ اپراتوری که سرور نشناسد، در زمان
 * ارزیابی بی‌صدا false می‌دهد و قانون انگار اصلا نوشته نشده رفتار می‌کند.
 */
export interface OperatorOption {
  value: string;
  label: string;
  /** آیا این اپراتور به مقدار مقایسه نیاز دارد؟ */
  needsValue: boolean;
}

export const OPERATORS: OperatorOption[] = [
  { value: 'equals', label: 'برابر باشد با', needsValue: true },
  { value: 'not_equals', label: 'برابر نباشد با', needsValue: true },
  { value: 'contains', label: 'شامل باشد', needsValue: true },
  { value: 'starts_with', label: 'شروع شود با', needsValue: true },
  { value: 'gt', label: 'بیشتر باشد از', needsValue: true },
  { value: 'lt', label: 'کمتر باشد از', needsValue: true },
  { value: 'is_empty', label: 'خالی باشد', needsValue: false },
  { value: 'is_not_empty', label: 'خالی نباشد', needsValue: false },
];

export function needsValue(operator: string): boolean {
  return OPERATORS.find((o) => o.value === operator)?.needsValue ?? true;
}

export function operatorLabel(operator: string): string {
  return OPERATORS.find((o) => o.value === operator)?.label ?? operator;
}

/**
 * مقدار متنی را در صورت عددی بودن به عدد تبدیل می‌کند.
 *
 * اپراتورهای `gt`/`lt` روی رشته مقایسه‌ی الفبایی می‌کنند و «10» کمتر از «9»
 * درمی‌آید؛ نگه داشتن نوع عددی جلوی این را می‌گیرد.
 */
export function coerce(text: string): string | number {
  const trimmed = text.trim();
  if (trimmed === '') return trimmed;
  const asNumber = Number(trimmed);
  return Number.isFinite(asNumber) && /^-?\d+(\.\d+)?$/.test(trimmed)
    ? asNumber
    : trimmed;
}
