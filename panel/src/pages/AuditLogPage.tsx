import { useQuery } from '@tanstack/react-query';
import { auditApi, describeError } from '../api';
import { isoToJalaliText } from '../jalali';

/** برچسبِ فارسیِ رویدادهای ممیزی؛ ناشناخته همان کلید نشان داده می‌شود. */
const ACTION_LABELS: Record<string, string> = {
  'response.approved': 'تأیید درخواست',
  'response.rejected': 'ردِ درخواست',
  'response.workflow_advanced': 'پیشرویِ گردش‌کار',
};

/** نمای لاگِ ممیزی — رویدادهای مهمِ سازمان (مدیر و بالاتر). */
export function AuditLogPage() {
  const log = useQuery({ queryKey: ['audit'], queryFn: auditApi.list });

  return (
    <div className="page">
      <header className="page-header">
        <h1>لاگِ ممیزی</h1>
      </header>

      <p className="hint">
        رویدادهای مهمِ سازمان (تأیید/ردِ درخواست‌ها و گردش‌کار) با زمان و کاربر.
      </p>

      {log.isLoading ? (
        <p>در حال بارگذاری…</p>
      ) : log.isError ? (
        <p className="error">{describeError(log.error)}</p>
      ) : (
        <section className="card">
          <table className="simple-table">
            <thead>
              <tr>
                <th>زمان</th>
                <th>رویداد</th>
                <th>کاربر</th>
                <th>جزئیات</th>
              </tr>
            </thead>
            <tbody>
              {(log.data ?? []).map((e) => (
                <tr key={e.id}>
                  <td>{isoToJalaliText(e.createdAt)}</td>
                  <td>{ACTION_LABELS[e.action] ?? e.action}</td>
                  <td>{e.actorId ?? '—'}</td>
                  <td>
                    {typeof e.payload?.formTitle === 'string'
                      ? String(e.payload.formTitle)
                      : ''}
                    {typeof e.payload?.note === 'string' && e.payload.note
                      ? ` — ${String(e.payload.note)}`
                      : ''}
                  </td>
                </tr>
              ))}
              {(log.data ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="hint">
                    هنوز رویدادی ثبت نشده.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
