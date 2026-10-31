import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  NewAssetForm,
  NewRequestForm,
  NewWorkOrderForm,
} from './operations/CmmsForms';
import {
  cmmsApi,
  type Asset,
  type CmmsPage,
  type CmmsQuery,
  type MaintenanceRequest,
  type OpsBucket,
  type WorkOrder,
} from '../api';

/** ردیفِ مشترکِ جدول؛ هر سه نوعِ رکورد در آن جا می‌شوند. */
type OpsRow = Partial<MaintenanceRequest & WorkOrder & Asset> & { id: string };

/** برچسب‌های فارسیِ وضعیت و اولویت. */
const STATUS_LABELS: Record<string, string> = {
  new: 'جدید',
  under_review: 'در حالِ بررسی',
  approved: 'تأییدشده',
  assigned: 'ارجاع‌شده',
  in_progress: 'در حالِ انجام',
  waiting_parts: 'منتظرِ قطعه',
  waiting_contractor: 'منتظرِ پیمانکار',
  follow_up: 'نیازمندِ پیگیری',
  completed: 'تکمیل‌شده',
  rejected: 'ردشده',
  closed: 'بسته',
  draft: 'بی‌متصدی',
  verified: 'تأییدِ مدیر',
  cancelled: 'لغوشده',
  operational: 'سالم',
  under_maintenance: 'در تعمیر',
  out_of_service: 'از کار افتاده',
  retired: 'بازنشسته',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'کم',
  normal: 'عادی',
  high: 'زیاد',
  emergency: 'اضطراری',
};

const KIND_LABELS: Record<OpsBucket['kind'], string> = {
  request: 'درخواست‌ها',
  workOrder: 'دستورهای کار',
  asset: 'تجهیزات',
};

const TONE_COLORS: Record<OpsBucket['tone'], string> = {
  info: 'var(--accent, #2563eb)',
  warn: '#b45309',
  danger: '#b91c1c',
};

const fa = (n: number) => n.toLocaleString('fa-IR');

/** تاریخِ کوتاهِ شمسی. */
const shortDate = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString('fa-IR') : '—';

/**
 * میزِ کارِ عملیاتیِ بخشِ فنی.
 *
 * برخلاف داشبوردسازِ نظرسنجی (که ویجت‌هایش به فرم گره خورده‌اند)، اینجا هر
 * عدد یک صفِ کارِ واقعی است و با کلیک همان رکوردها را باز می‌کند؛ یعنی
 * داشبورد به «الان چه چیزی توجه می‌خواهد؟» جواب می‌دهد، نه فقط آمار.
 */
/** گذارهای مجازی که از روی جدول در دسترس‌اند (آینهٔ قواعدِ سرور). */
const REQUEST_ACTIONS: Record<string, Array<{ to: string; label: string }>> = {
  new: [
    { to: 'under_review', label: 'بررسی' },
    { to: 'approved', label: 'تأیید' },
    { to: 'rejected', label: 'رد' },
  ],
  under_review: [
    { to: 'approved', label: 'تأیید' },
    { to: 'rejected', label: 'رد' },
  ],
  in_progress: [{ to: 'completed', label: 'تکمیل' }],
  completed: [{ to: 'closed', label: 'بستن' }],
};

const WORK_ORDER_ACTIONS: Record<string, Array<{ to: string; label: string }>> =
  {
    assigned: [{ to: 'in_progress', label: 'شروع' }],
    in_progress: [
      { to: 'waiting_parts', label: 'منتظرِ قطعه' },
      { to: 'completed', label: 'تکمیل' },
    ],
    waiting_parts: [{ to: 'in_progress', label: 'ادامه' }],
    waiting_contractor: [{ to: 'in_progress', label: 'ادامه' }],
    completed: [{ to: 'verified', label: 'تأییدِ مدیر' }],
    verified: [{ to: 'closed', label: 'بستن' }],
  };

export function OperationsPage() {
  const qc = useQueryClient();
  const [active, setActive] = useState<OpsBucket | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  /** کدام فرمِ ثبت باز است. */
  const [creating, setCreating] = useState<
    null | 'request' | 'workOrder' | 'asset'
  >(null);
  /** ساختِ دستورِ کار از روی یک درخواستِ مشخص. */
  const [fromRequest, setFromRequest] = useState<OpsRow | null>(null);

  const changeStatus = useMutation({
    // خروجیِ دو مسیر شکلِ یکسان ندارد و اینجا لازم هم نیست؛ فقط باطل‌کردنِ
    // کوئری‌ها مهم است.
    mutationFn: async ({
      kind,
      id,
      to,
    }: {
      kind: OpsBucket['kind'];
      id: string;
      to: string;
    }): Promise<void> => {
      if (kind === 'request') await cmmsApi.setRequestStatus(id, to);
      else await cmmsApi.setWorkOrderStatus(id, to);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['cmms-dashboard'] });
      await qc.invalidateQueries({ queryKey: ['cmms-records'] });
    },
  });

  const dashboard = useQuery({
    queryKey: ['cmms-dashboard'],
    queryFn: () => cmmsApi.dashboard(),
    // داده‌ی عملیاتی زود کهنه می‌شود؛ با برگشتن به صفحه تازه شود.
    refetchOnWindowFocus: true,
  });

  const query: CmmsQuery = {
    ...(active?.filter ?? {}),
    ...(search.trim() ? { search: search.trim() } : {}),
    page,
    pageSize: 20,
  };

  /*
   * هر سه فهرست یک شکلِ صفحه‌بندی دارند و فقط نوعِ ردیف فرق می‌کند؛ با یک
   * نوعِ مشترک، جدول بدونِ شاخه‌شاخه‌شدن هر سه را نشان می‌دهد.
   */
  const records = useQuery<CmmsPage<OpsRow> | null>({
    queryKey: ['cmms-records', active?.key, search, page],
    queryFn: async () => {
      if (!active) return null;
      if (active.kind === 'request') return cmmsApi.requests(query);
      if (active.kind === 'workOrder') return cmmsApi.workOrders(query);
      return cmmsApi.assets(query);
    },
    enabled: Boolean(active),
  });

  const openBucket = (bucket: OpsBucket) => {
    setActive(bucket);
    setSearch('');
    setPage(1);
  };

  const data = dashboard.data;

  return (
    <div className="page">
      <header className="page-header">
        <h1>عملیاتِ فنی</h1>
        <div className="header-actions">
          <button type="button" onClick={() => setCreating('request')}>
            + درخواستِ تعمیر
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => setCreating('workOrder')}
          >
            + دستورِ کار
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => setCreating('asset')}
          >
            + تجهیز
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => void dashboard.refetch()}
            disabled={dashboard.isFetching}
          >
            {dashboard.isFetching ? 'در حال به‌روزرسانی…' : 'به‌روزرسانی'}
          </button>
        </div>
      </header>

      {creating === 'request' && (
        <NewRequestForm onClose={() => setCreating(null)} />
      )}
      {creating === 'asset' && (
        <NewAssetForm onClose={() => setCreating(null)} />
      )}
      {creating === 'workOrder' && (
        <NewWorkOrderForm onClose={() => setCreating(null)} />
      )}
      {fromRequest && (
        <NewWorkOrderForm
          fromRequestId={fromRequest.id}
          defaults={{
            title: fromRequest.title,
            category: fromRequest.category,
            priority: fromRequest.priority,
          }}
          onClose={() => setFromRequest(null)}
        />
      )}

      {dashboard.isLoading && <p>در حال بارگذاری…</p>}
      {dashboard.isError && (
        <p className="error">خواندنِ داشبورد ناموفق بود.</p>
      )}

      {data && (
        <>
          {/* سطل‌های قابلِ‌اقدام: هر کدام با کلیک رکوردهایش را باز می‌کند. */}
          <section className="card">
            <div className="section-head">
              <h3>چه چیزی توجه می‌خواهد؟</h3>
              <span className="hint">
                به‌روزرسانی: {new Date(data.generatedAt).toLocaleTimeString('fa-IR')}
              </span>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(10.5rem, 1fr))',
                gap: '0.6rem',
              }}
            >
              {data.buckets.map((b) => {
                const isActive = active?.key === b.key;
                return (
                  <button
                    key={b.key}
                    type="button"
                    onClick={() => openBucket(b)}
                    title={`نمایشِ ${KIND_LABELS[b.kind]}`}
                    style={{
                      textAlign: 'start',
                      padding: '0.6rem 0.7rem',
                      borderRadius: 10,
                      cursor: 'pointer',
                      border: `1px solid ${
                        isActive ? TONE_COLORS[b.tone] : 'var(--border, #d4d4d8)'
                      }`,
                      background: isActive
                        ? 'var(--surface-2, rgba(37,99,235,0.07))'
                        : 'transparent',
                      color: 'inherit',
                      font: 'inherit',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '1.5rem',
                        fontWeight: 700,
                        lineHeight: 1.1,
                        color: b.count > 0 ? TONE_COLORS[b.tone] : 'inherit',
                        opacity: b.count > 0 ? 1 : 0.45,
                      }}
                    >
                      {fa(b.count)}
                    </div>
                    <div style={{ fontSize: '0.82rem', opacity: 0.85 }}>
                      {b.label}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="builder-layout">
            <div className="builder">
              {/* جدولِ رکوردها: فقط وقتی سطلی انتخاب شده. */}
              <section className="card">
                <div className="section-head">
                  <h3>
                    {active
                      ? `${active.label} — ${KIND_LABELS[active.kind]}`
                      : 'یک مورد را از بالا انتخاب کنید'}
                  </h3>
                  {active && (
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => setActive(null)}
                    >
                      بستن
                    </button>
                  )}
                </div>

                {active && (
                  <>
                    <div className="inline-form">
                      <input
                        value={search}
                        placeholder="جست‌وجو در عنوان یا شماره…"
                        onChange={(e) => {
                          setSearch(e.target.value);
                          setPage(1);
                        }}
                      />
                    </div>

                    {records.isLoading && <p>در حال بارگذاری…</p>}
                    {records.data && records.data.rows.length === 0 && (
                      <p className="hint">موردی نیست.</p>
                    )}

                    {records.data && records.data.rows.length > 0 && (
                      <>
                        <div className="table-scroll">
                          <table>
                            <thead>
                              <tr>
                                <th>شماره</th>
                                <th>عنوان</th>
                                <th>وضعیت</th>
                                {active.kind !== 'asset' && <th>اولویت</th>}
                                {active.kind !== 'asset' && <th>موعد</th>}
                                <th>ثبت</th>
                                {active.kind !== 'asset' && <th>اقدام</th>}
                              </tr>
                            </thead>
                            <tbody>
                              {records.data.rows.map((r) => {
                                return (
                                  <tr key={r.id}>
                                    <td>{r.number ?? r.code ?? '—'}</td>
                                    <td>{r.title ?? r.name}</td>
                                    <td>
                                      {STATUS_LABELS[r.status ?? ''] ??
                                        r.status}
                                    </td>
                                    {active.kind !== 'asset' && (
                                      <td>
                                        {PRIORITY_LABELS[r.priority ?? ''] ??
                                          '—'}
                                      </td>
                                    )}
                                    {active.kind !== 'asset' && (
                                      <td>{r.dueDate || '—'}</td>
                                    )}
                                    <td>{shortDate(r.createdAt ?? '')}</td>
                                    {active.kind !== 'asset' && (
                                      <td>
                                        <span className="question-actions">
                                          {(active.kind === 'request'
                                            ? REQUEST_ACTIONS
                                            : WORK_ORDER_ACTIONS)[
                                            r.status ?? ''
                                          ]?.map((act) => (
                                            <button
                                              key={act.to}
                                              type="button"
                                              disabled={changeStatus.isPending}
                                              onClick={() =>
                                                changeStatus.mutate({
                                                  kind: active.kind,
                                                  id: r.id,
                                                  to: act.to,
                                                })
                                              }
                                            >
                                              {act.label}
                                            </button>
                                          ))}
                                          {/* از درخواستِ تأییدشده مستقیم دستورِ کار بساز. */}
                                          {active.kind === 'request' &&
                                            r.status === 'approved' && (
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  setFromRequest(r)
                                                }
                                              >
                                                دستورِ کار
                                              </button>
                                            )}
                                        </span>
                                      </td>
                                    )}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* صفحه‌بندی */}
                        <div className="inline-form">
                          <button
                            type="button"
                            disabled={page <= 1}
                            onClick={() => setPage((p) => p - 1)}
                          >
                            قبلی
                          </button>
                          <span className="hint">
                            صفحهٔ {fa(records.data.page)} از{' '}
                            {fa(
                              Math.max(
                                1,
                                Math.ceil(
                                  records.data.total / records.data.pageSize,
                                ),
                              ),
                            )}{' '}
                            — مجموع {fa(records.data.total)}
                          </span>
                          <button
                            type="button"
                            disabled={
                              records.data.page * records.data.pageSize >=
                              records.data.total
                            }
                            onClick={() => setPage((p) => p + 1)}
                          >
                            بعدی
                          </button>
                        </div>
                      </>
                    )}
                  </>
                )}
              </section>
            </div>

            <div className="side-column">
              <section className="card">
                <h3>هزینهٔ {fa(data.cost.days)} روزِ گذشته</h3>
                <dl className="info-list">
                  <dt>داخلی</dt>
                  <dd>{fa(data.cost.internal)} ریال</dd>
                  <dt>پیمانکار</dt>
                  <dd>{fa(data.cost.contractor)} ریال</dd>
                  <dt>زمانِ کار</dt>
                  <dd>{fa(Math.round(data.cost.laborMinutes / 60))} ساعت</dd>
                </dl>
              </section>

              <section className="card">
                <h3>بارِ کاریِ تکنسین‌ها</h3>
                {data.workload.length === 0 ? (
                  <p className="hint">کارِ بازِ ارجاع‌شده‌ای نیست.</p>
                ) : (
                  <ul>
                    {data.workload.map((w) => (
                      <li key={w.personnelId}>
                        {w.name} — {fa(w.openCount)} کارِ باز
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="card">
                <h3>فعالیتِ اخیر</h3>
                {data.recent.length === 0 ? (
                  <p className="hint">فعالیتی ثبت نشده است.</p>
                ) : (
                  <ul>
                    {data.recent.map((a) => (
                      <li key={`${a.kind}-${a.id}`}>
                        <strong>{a.number}</strong> — {a.title}{' '}
                        <span className="hint">
                          ({STATUS_LABELS[a.status] ?? a.status})
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
