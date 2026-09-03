import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { contactsApi, describeError } from '../api';
import type { ContactSourceInput } from '../api';

interface PreviewResult {
  totalFetched: number;
  usable: number;
  unusable: number;
  sampleRaw: Array<Record<string, unknown>>;
  sampleMapped: Array<Record<string, unknown>>;
}

const EMPTY: ContactSourceInput = {
  listId: '',
  name: '',
  url: '',
  method: 'GET',
  headers: {},
  itemsPath: '',
  mapping: { fullName: '', mobile: '', email: '' },
};

/**
 * اتصال به API نرم‌افزارهایی که فهرست افراد را دارند
 * (CRM، سامانه‌ی منابع انسانی، باشگاه مشتریان و …).
 */
export function ContactSourcesPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ContactSourceInput>(EMPTY);
  const [authHeader, setAuthHeader] = useState('');
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const lists = useQuery({
    queryKey: ['contact-lists'],
    queryFn: contactsApi.lists,
  });

  const sources = useQuery({
    queryKey: ['contact-sources'],
    queryFn: contactsApi.sources,
  });

  // هدر احراز هویت جدا گرفته می‌شود چون رایج‌ترین حالت است؛
  // بقیه‌ی هدرها در نسخه‌های بعد قابل افزودن‌اند.
  const payload = (): ContactSourceInput => ({
    ...form,
    headers: authHeader.trim() ? { authorization: authHeader.trim() } : {},
  });

  const runPreview = useMutation({
    mutationFn: () => contactsApi.previewSource(payload()),
    onSuccess: (data) => {
      setError(null);
      setPreview(data);
    },
    onError: (err) => {
      setPreview(null);
      setError(describeError(err));
    },
  });

  const save = useMutation({
    mutationFn: () => contactsApi.createSource(payload()),
    onSuccess: async () => {
      setError(null);
      setMessage('اتصال ذخیره شد');
      setPreview(null);
      setForm(EMPTY);
      setAuthHeader('');
      await queryClient.invalidateQueries({ queryKey: ['contact-sources'] });
    },
    onError: (err) => setError(describeError(err)),
  });

  const sync = useMutation({
    mutationFn: (sourceId: string) => contactsApi.syncSource(sourceId),
    onSuccess: async (result) => {
      setError(null);
      setMessage(
        `همگام‌سازی انجام شد: ${result.created} مخاطب جدید، ${result.updated} به‌روزرسانی`,
      );
      await queryClient.invalidateQueries({ queryKey: ['contact-sources'] });
      await queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
    onError: (err) => setError(describeError(err)),
  });

  const remove = useMutation({
    mutationFn: (sourceId: string) => contactsApi.removeSource(sourceId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['contact-sources'] });
    },
    onError: (err) => setError(describeError(err)),
  });

  const set = (patch: Partial<ContactSourceInput>) =>
    setForm((prev) => ({ ...prev, ...patch }));

  const setMapping = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, mapping: { ...prev.mapping, [key]: value } }));

  const canSubmit =
    form.listId && form.name.trim() && form.url.trim() && form.mapping.mobile;

  return (
    <div className="page">
      <header className="page-header">
        <h1>اتصال به نرم‌افزارهای دیگر</h1>
      </header>

      {error && <p className="error">{error}</p>}
      {message && <p className="hint success">{message}</p>}

      <section className="card">
        <h3>اتصال جدید</h3>
        <p className="hint">
          نشانی API سرویسی را بدهید که فهرست افراد را برمی‌گرداند؛ سامانه
          رکوردها را می‌خواند و در دفترچه مخاطبان می‌نشاند.
        </p>

        <div className="grid-2">
          <label>
            نام اتصال
            <input
              value={form.name}
              placeholder="CRM سازمانی"
              onChange={(e) => set({ name: e.target.value })}
            />
          </label>

          <label>
            فهرست مقصد
            <select
              value={form.listId}
              onChange={(e) => set({ listId: e.target.value })}
            >
              <option value="">انتخاب کنید</option>
              {lists.data?.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label>
          نشانی API
          <input
            value={form.url}
            placeholder="https://crm.example.com/api/customers"
            onChange={(e) => set({ url: e.target.value })}
          />
        </label>

        <div className="grid-2">
          <label>
            روش درخواست
            <select
              value={form.method}
              onChange={(e) => set({ method: e.target.value })}
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
            </select>
          </label>

          <label>
            هدر احراز هویت
            <input
              value={authHeader}
              placeholder="Bearer xxxxx"
              onChange={(e) => setAuthHeader(e.target.value)}
            />
          </label>
        </div>

        <label>
          مسیر آرایه در پاسخ — خالی یعنی خودِ پاسخ آرایه است
          <input
            value={form.itemsPath}
            placeholder="data.customers"
            onChange={(e) => set({ itemsPath: e.target.value })}
          />
        </label>

        <h4>نگاشت فیلدها</h4>
        <p className="hint">
          نام کلید در پاسخ سرویس را بنویسید. برای فیلد تو در تو از نقطه
          استفاده کنید، مثل <code>profile.phone</code>.
        </p>

        <div className="grid-2">
          <label>
            نام کامل
            <input
              value={form.mapping.fullName ?? ''}
              placeholder="full_name"
              onChange={(e) => setMapping('fullName', e.target.value)}
            />
          </label>
          <label>
            موبایل (لازم)
            <input
              value={form.mapping.mobile ?? ''}
              placeholder="phone_number"
              onChange={(e) => setMapping('mobile', e.target.value)}
            />
          </label>
          <label>
            ایمیل
            <input
              value={form.mapping.email ?? ''}
              placeholder="email_address"
              onChange={(e) => setMapping('email', e.target.value)}
            />
          </label>
        </div>

        <div className="inline-form">
          <button
            type="button"
            className="secondary"
            disabled={!canSubmit || runPreview.isPending}
            onClick={() => runPreview.mutate()}
          >
            {runPreview.isPending ? 'در حال اتصال…' : 'پیش‌نمایش'}
          </button>
          <button
            type="button"
            disabled={!canSubmit || !preview || save.isPending}
            onClick={() => save.mutate()}
          >
            ذخیره‌ی اتصال
          </button>
        </div>
      </section>

      {preview && (
        <section className="card">
          <h3>پیش‌نمایش</h3>
          <p className="hint">
            {preview.totalFetched} رکورد دریافت شد؛ {preview.usable} قابل
            استفاده،‌ {preview.unusable} بدون موبایل و ایمیل.
          </p>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>نام</th>
                  <th>موبایل</th>
                  <th>ایمیل</th>
                  <th>متغیرها</th>
                </tr>
              </thead>
              <tbody>
                {preview.sampleMapped.map((row, index) => (
                  <tr key={index}>
                    <td>{String(row.fullName ?? '—')}</td>
                    <td>{String(row.mobile ?? '—')}</td>
                    <td>{String(row.email ?? '—')}</td>
                    <td>{JSON.stringify(row.variables ?? {})}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {preview.usable === 0 && (
            <p className="warning-line">
              هیچ رکورد قابل استفاده‌ای پیدا نشد. «مسیر آرایه» و نگاشت فیلد
              موبایل را بررسی کنید.
            </p>
          )}
        </section>
      )}

      <section className="card">
        <h3>اتصال‌های ذخیره‌شده</h3>
        {sources.data?.length === 0 && (
          <p className="empty">هنوز اتصالی تعریف نشده است.</p>
        )}

        {sources.data?.map((source) => (
          <div key={source.id} className="source-row">
            <div>
              <strong>{source.name}</strong>
              <div className="hint">{source.url}</div>
              <div className="hint">
                {source.lastSyncedAt
                  ? `آخرین همگام‌سازی: ${new Date(source.lastSyncedAt).toLocaleString('fa-IR')}`
                  : 'هنوز همگام نشده'}
              </div>
            </div>
            <div className="inline-form">
              <button
                type="button"
                className="secondary"
                disabled={sync.isPending}
                onClick={() => sync.mutate(source.id)}
              >
                همگام‌سازی
              </button>
              <button
                type="button"
                className="danger"
                onClick={() => remove.mutate(source.id)}
              >
                حذف
              </button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
