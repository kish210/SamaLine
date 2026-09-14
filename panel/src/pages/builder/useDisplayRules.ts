import { useEffect, useState } from 'react';
import type { DisplayRule } from '../../types';

/**
 * نگه‌داری قوانین نمایش در وضعیت محلی ویرایشگر.
 *
 * مثل `useSkipRules`: ساختار سرور فقط با عوض شدن نسخه دوباره نشانده می‌شود،
 * وگرنه هر بازخوانی پس‌زمینه‌ی react-query ویرایش‌های ذخیره‌نشده را پاک می‌کرد.
 */
export function useDisplayRules(
  logic: Record<string, unknown> | undefined,
  versionKey: string,
) {
  const [rules, setRules] = useState<DisplayRule[]>(
    () => (logic?.display as DisplayRule[] | undefined) ?? [],
  );

  useEffect(() => {
    setRules((logic?.display as DisplayRule[] | undefined) ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versionKey]);

  return [rules, setRules] as const;
}
