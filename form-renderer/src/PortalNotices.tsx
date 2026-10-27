import { useEffect, useState } from 'react';
import { formApi } from './api';
import type { PortalAnnouncement } from './api';
import { isoToJalaliText } from './jalali';

/**
 * اطلاعیه‌های سازمانی در پورتالِ سلف‌سرویس (فاز G).
 *
 * اطلاعیهٔ عمومیِ سازمان را کنارِ «درخواست‌های من» نشان می‌دهد. فقط برای
 * پاسخ‌دهنده‌ی احراز‌شده پر می‌شود؛ وگرنه پاسخ خالی است و چیزی دیده نمی‌شود.
 */
export function PortalNotices({ token }: { token: string }) {
  const [items, setItems] = useState<PortalAnnouncement[] | null>(null);

  useEffect(() => {
    let alive = true;
    formApi
      .announcements(token)
      .then((data) => {
        if (alive) setItems(data.announcements);
      })
      .catch(() => {
        if (alive) setItems([]);
      });
    return () => {
      alive = false;
    };
  }, [token]);

  if (!items || items.length === 0) return null;

  return (
    <section className="portal-notices">
      <h3>اطلاعیه‌ها</h3>
      <ul>
        {items.map((a) => (
          <li key={a.id}>
            <div className="notice-head">
              <strong>{a.title}</strong>
              <span className="notice-date">
                {(a.createdAt && isoToJalaliText(a.createdAt)) || ''}
              </span>
            </div>
            <p className="notice-body">{a.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
