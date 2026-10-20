import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { describeError, emailReportApi, formsApi } from '../api';

/**
 * گزارش دوره‌ای ایمیلی: خلاصه‌ی هفتگی یا ماهانه‌ی فرم‌ها به ایمیل مدیران.
 *
 * مستقل از تلگرام/بله است؛ مدیری که ایمیل را دنبال می‌کند لازم نیست ربات
 * داشته باشد. برای ارسال واقعی باید روی سرور `EMAIL_PROVIDER=smtp` تنظیم
 * باشد؛ وگرنه گزارش در فایل محلی لاگ می‌شود.
 */
export function EmailReportCard({ workspaceId }: { workspaceId: string }) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [label, setLabel] = useState('');
  const [formId, setFormId] = useState('');
  const [digest, setDigest] = useState<'weekly' | 'monthly'>('weekly');
  const [message, setMessage] = useState('');

  const list = useQuery({
    queryKey: ['email-reports', workspaceId],
    queryFn: () => emailReportApi.list(workspaceId),
    enabled: Boolean(workspaceId),
  });

  const forms = useQuery({
    queryKey: ['forms', workspaceId],
    queryFn: () => formsApi.list(workspaceId),
    enabled: Boolean(workspaceId),
  });

  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: ['email-reports'] });

  const add = useMutation({
    mutationFn: () =>
      emailReportApi.add(workspaceId, {
        formId: formId || null,
        email: email.trim(),
        label: label.trim() || undefined,
        digest,
      }),
    onSuccess: () => {
      setEmail('');
      setLabel('');
      setMessage('گیرنده اضافه شد.');
      refresh();
    },
    onError: (error) => setMessage(describeError(error)),
  });

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      emailReportApi.update(workspaceId, id, { isActive }),
    onSuccess: refresh,
  });

  const remove = useMutation({
    mutationFn: (id: string) => emailReportApi.remove(workspaceId, id),
    onSuccess: refresh,
  });

  const test = useMutation({
    mutationFn: (id: string) => emailReportApi.test(workspaceId, id),
    onSuccess: () => setMessage('گزارش آزمایشی فرستاده شد؛ ایمیل را ببینید.'),
    onError: (error) => setMessage(describeError(error)),
  });

  const rows = list.data ?? [];

  return (
    <section className="card">
      <h3>گزارش دوره‌ای ایمیلی</h3>
      <p className="hint">
        خلاصه‌ی هفتگی یا ماهانه‌ی فرم‌ها (تعداد پاسخ، شاخص‌ها و کمترین امتیازها)
        به‌صورت خودکار به ایمیل مدیران فرستاده می‌شود.
      </p>

      {message && <p className="hint">{message}</p>}

      <div className="inline-form">
        <input
          type="email"
          dir="ltr"
          placeholder="manager@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          placeholder="برچسب (اختیاری)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
      </div>

      <div className="inline-form">
        <label className="inline-select">
          <span>فرم</span>
          <select value={formId} onChange={(e) => setFormId(e.target.value)}>
            <option value="">همه‌ی فرم‌ها</option>
            {(forms.data ?? []).map((f) => (
              <option key={f.id} value={f.id}>
                {f.title}
              </option>
            ))}
          </select>
        </label>
        <label className="inline-select">
          <span>بازه</span>
          <select
            value={digest}
            onChange={(e) => setDigest(e.target.value as 'weekly' | 'monthly')}
          >
            <option value="weekly">هفتگی</option>
            <option value="monthly">ماهانه</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => add.mutate()}
          disabled={add.isPending || !email.trim()}
        >
          {add.isPending ? 'در حال افزودن…' : 'افزودن گیرنده'}
        </button>
      </div>

      {rows.length > 0 && (
        <table className="simple-table" style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th>ایمیل</th>
              <th>فرم</th>
              <th>بازه</th>
              <th>فعال</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td dir="ltr">
                  {row.email}
                  {row.lastError && (
                    <div className="error" style={{ fontSize: 12 }}>
                      {row.lastError}
                    </div>
                  )}
                </td>
                <td>
                  {row.formId
                    ? (forms.data ?? []).find((f) => f.id === row.formId)
                        ?.title ?? '—'
                    : 'همه'}
                </td>
                <td>{row.digest === 'weekly' ? 'هفتگی' : 'ماهانه'}</td>
                <td>
                  <input
                    type="checkbox"
                    checked={row.isActive}
                    onChange={(e) =>
                      toggle.mutate({ id: row.id, isActive: e.target.checked })
                    }
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => test.mutate(row.id)}
                  >
                    ارسال آزمایشی
                  </button>
                  <button
                    type="button"
                    className="link-button danger"
                    onClick={() => remove.mutate(row.id)}
                  >
                    حذف
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
