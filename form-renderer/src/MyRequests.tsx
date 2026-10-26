import { useEffect, useState } from 'react';
import { formApi } from './api';
import type { MyRequest } from './api';
import { isoToJalaliText } from './jalali';

const REVIEW_LABELS: Record<string, string> = {
  pending: 'در انتظار تأیید',
  approved: 'تأییدشده',
  rejected: 'ردشده',
};

/**
 * «درخواست‌های من» — پورتالِ سلف‌سرویسِ کارمند (فاز E).
 *
 * پس از ثبتِ درخواست (یا هنگامِ باز کردنِ فرمِ احراز‌شده) کارمند وضعیتِ تأییدِ
 * درخواست‌های خودش را می‌بیند. هویت از توکنِ ورود می‌آید؛ اگر فرم بی‌نام باشد
 * پاسخی برنمی‌گردد و این بخش دیده نمی‌شود.
 */
export function MyRequests({ token }: { token: string }) {
  const [requests, setRequests] = useState<MyRequest[] | null>(null);

  useEffect(() => {
    let alive = true;
    formApi
      .myResponses(token)
      .then((data) => {
        if (alive) setRequests(data.requests);
      })
      .catch(() => {
        if (alive) setRequests([]);
      });
    return () => {
      alive = false;
    };
  }, [token]);

  if (!requests || requests.length === 0) return null;

  return (
    <section className="my-requests">
      <h3>درخواست‌های من</h3>
      <ul>
        {requests.map((req) => {
          const status = req.review?.status ?? 'pending';
          return (
            <li key={req.id}>
              <span className="my-req-date">
                {(req.submittedAt && isoToJalaliText(req.submittedAt)) || '—'}
              </span>
              {req.review ? (
                <span className={`my-req-badge ${status}`}>
                  {REVIEW_LABELS[status] ?? status}
                </span>
              ) : (
                <span className="my-req-badge done">ثبت‌شده</span>
              )}
              {req.review?.note && status === 'rejected' && (
                <span className="my-req-note">{req.review.note}</span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
