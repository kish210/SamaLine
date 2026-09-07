import { useEffect, useState } from 'react';
import type { SkipRule } from '../../types';

/**
 * نگه‌داری قوانین پرش در وضعیت محلی ویرایشگر.
 *
 * مثل صفحه‌ها و شاخص‌ها، ساختار سرور فقط با عوض شدن نسخه دوباره نشانده
 * می‌شود؛ وگرنه هر بازخوانی پس‌زمینه‌ی react-query ویرایش‌های ذخیره‌نشده را
 * پاک می‌کرد.
 */
export function useSkipRules(
  logic: Record<string, unknown> | undefined,
  versionKey: string,
) {
  const [rules, setRules] = useState<SkipRule[]>(
    () => (logic?.skip as SkipRule[] | undefined) ?? [],
  );

  useEffect(() => {
    setRules((logic?.skip as SkipRule[] | undefined) ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versionKey]);

  return [rules, setRules] as const;
}
