import { useEffect, useState } from 'react';

/** همان نقطه‌ی شکستی که CSS برای چیدمان کشویی استفاده می‌کند. */
const NARROW = '(max-width: 860px)';

/**
 * آیا نمایشگر باریک است؟
 *
 * از `matchMedia` استفاده می‌شود نه `window.innerWidth` با شنونده‌ی resize:
 * مرورگر خودش فقط هنگام عبور از نقطه‌ی شکست خبر می‌دهد، پس با هر پیکسل
 * تغییر اندازه یک رندر دوباره اتفاق نمی‌افتد.
 */
export function useNarrowScreen(): boolean {
  const [narrow, setNarrow] = useState(
    () => window.matchMedia(NARROW).matches,
  );

  useEffect(() => {
    const query = window.matchMedia(NARROW);
    const update = (event: MediaQueryListEvent) => setNarrow(event.matches);
    query.addEventListener('change', update);
    // بین رندر اول و این افکت ممکن است اندازه عوض شده باشد.
    setNarrow(query.matches);
    return () => query.removeEventListener('change', update);
  }, []);

  return narrow;
}
