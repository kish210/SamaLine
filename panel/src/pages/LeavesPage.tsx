import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  describeError,
  hrApi,
  leavesApi,
  type HrBucket,
  type LeaveRequest,
} from '../api';

const TYPE_LABELS: Record<string, string> = {
  annual: 'استحقاقی',
  sick: 'استعلاجی',
  unpaid: 'بدونِ حقوق',
  mission: 'مأموریت',
  hourly: 'ساعتی',
  other: 'سایر',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'منتظرِ تأیید',
  approved: 'تأییدشده',
  rejected: 'ردشده',
  cancelled: 'لغوشده',
};

const TONE_COLORS: Record<HrBucket['tone'], string> = {
  info: 'var(--accent, #2563eb)',
  warn: '#b45309',
  danger: '#b91c1c',
};

const fa = (n: number) => n.toLocaleString('fa-IR');
const shortDate = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString('fa-IR') : '—';

/** سالِ جاری؛ ماندهٔ مرخصی بر مبنای سالِ میلادیِ شروعِ مرخصی حساب می‌شود. */
const thisYear = new Date().getFullYear();

/**
 * سال با رقمِ فارسی ولی بدونِ جداکنندهٔ هزارگان.
 *
 * `toLocaleString` سال را «۲٬۰۲۶» می‌کرد که عدد به‌نظر می‌رسید نه سال.
 */
const faYear = (y: number) =>
  String(y).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);

/**
 * میزِ کارِ منابع انسانی.
 *
 * تا پیش از این APIهای مرخصی ساخته شده بودند ولی هیچ راهی از پنل به آن‌ها
 * نبود؛ این صفحه همان شکاف را می‌بندد: دیدنِ صف، ثبت، تصمیم و ماندهٔ مرخصی.
 */
export function LeavesPage() {
  const qc = useQueryClient();
  const [active, setActive] = useState<HrBucket | null>(null);
  const [creating, setCreating] = useState(false);
  const [balanceFor, setBalanceFor] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const summary = useQuery({
    queryKey: ['hr-summary'],
    queryFn: leavesApi.summary,
    refetchOnWindowFocus: true,
  });

  const personnel = useQuery({ queryKey: ['personnel'], queryFn: hrApi.list });

  const list = useQuery({
    queryKey: ['leaves', active?.key],
    // بدونِ انتخابِ سطل، صفِ «منتظرِ تأیید» پیش‌فرض است؛ همان چیزی که
    // مدیرِ منابع انسانی اول صبح می‌خواهد ببیند.
    queryFn: () => leavesApi.list(active?.filter ?? { status: 'pending' }),
  });

  const decide = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      leavesApi.decide(id, status),
    onSuccess: async () => {
      setError(null);
      await qc.invalidateQueries({ queryKey: ['hr-summary'] });
      await qc.invalidateQueries({ queryKey: ['leaves'] });
    },
    onError: (e) => setError(describeError(e)),
  });

  const balance = useQuery({
    queryKey: ['leave-balance', balanceFor],
    queryFn: () => leavesApi.balance(balanceFor, thisYear),
    enabled: Boolean(balanceFor),
  });

  const nameOf = (row: LeaveRequest) =>
    row.personnelName ??
    personnel.data?.find((p) => p.id === row.personnelId)?.fullName ??
    '—';

  return (
    <div className="page">
      <header className="page-header">
        <h1>مرخصی و منابع انسانی</h1>
        <div className="header-actions">
          <button type="button" onClick={() => setCreating(true)}>
            + ثبتِ مرخصی
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => void summary.refetch()}
            disabled={summary.isFetching}
          >
            {summary.isFetching ? 'در حال به‌روزرسانی…' : 'به‌روزرسانی'}
          </button>
        </div>
      </header>

      {error && <p className="error">{error}</p>}

      {creating && (
        <NewLeaveForm
          onClose={() => setCreating(false)}
          people={personnel.data ?? []}
        />
      )}

      {summary.data && (
        <section className="card">
          <div className="section-head">
            <h3>چه چیزی توجه می‌خواهد؟</h3>
            <span className="hint">
              نیروی فعال: {fa(summary.data.headcount)}
              {summary.data.terminated > 0 &&
                ` · قطعِ همکاری: ${fa(summary.data.terminated)}`}
            </span>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(12rem, 1fr))',
              gap: '0.6rem',
            }}
          >
            {summary.data.buckets.map((b) => {
              const isActive = active?.key === b.key;
              return (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => setActive(isActive ? null : b)}
                  disabled={b.kind !== 'leave'}
                  title={
                    b.kind === 'leave'
                      ? 'نمایشِ درخواست‌ها'
                      : 'از صفحه‌ی پرسنل ببینید'
                  }
                  style={{
                    textAlign: 'start',
                    padding: '0.6rem 0.7rem',
                    borderRadius: 10,
                    cursor: b.kind === 'leave' ? 'pointer' : 'default',
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
      )}

      <div className="builder-layout">
        <div className="builder">
          <section className="card">
            <div className="section-head">
              <h3>{active ? active.label : 'منتظرِ تأیید'}</h3>
              {active && (
                <button
                  type="button"
                  className="link-button"
                  onClick={() => setActive(null)}
                >
                  بازگشت به صفِ تأیید
                </button>
              )}
            </div>

            {list.isLoading && <p>در حال بارگذاری…</p>}
            {list.data && list.data.rows.length === 0 && (
              <p className="hint">موردی نیست.</p>
            )}

            {list.data && list.data.rows.length > 0 && (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>شماره</th>
                      <th>کارمند</th>
                      <th>نوع</th>
                      <th>از</th>
                      <th>تا</th>
                      <th>روز</th>
                      <th>وضعیت</th>
                      <th>اقدام</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.data.rows.map((r) => (
                      <tr key={r.id}>
                        <td>{r.number}</td>
                        <td>{nameOf(r)}</td>
                        <td>{TYPE_LABELS[r.type] ?? r.type}</td>
                        <td>{shortDate(r.fromDate)}</td>
                        <td>{shortDate(r.toDate)}</td>
                        <td>{fa(r.days)}</td>
                        <td>{STATUS_LABELS[r.status] ?? r.status}</td>
                        <td>
                          <span className="question-actions">
                            {r.status === 'pending' && (
                              <>
                                <button
                                  type="button"
                                  disabled={decide.isPending}
                                  onClick={() =>
                                    decide.mutate({
                                      id: r.id,
                                      status: 'approved',
                                    })
                                  }
                                >
                                  تأیید
                                </button>
                                <button
                                  type="button"
                                  className="danger"
                                  disabled={decide.isPending}
                                  onClick={() =>
                                    decide.mutate({
                                      id: r.id,
                                      status: 'rejected',
                                    })
                                  }
                                >
                                  رد
                                </button>
                              </>
                            )}
                            {r.status === 'approved' && (
                              <button
                                type="button"
                                disabled={decide.isPending}
                                onClick={() =>
                                  decide.mutate({
                                    id: r.id,
                                    status: 'cancelled',
                                  })
                                }
                              >
                                لغو
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setBalanceFor(r.personnelId)}
                            >
                              مانده
                            </button>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <div className="side-column">
          <BalanceCard
            personnelId={balanceFor}
            onPick={setBalanceFor}
            people={personnel.data ?? []}
            rows={balance.data ?? []}
          />
        </div>
      </div>
    </div>
  );
}

/** ماندهٔ مرخصیِ یک کارمند + تعیینِ سقف. */
function BalanceCard({
  personnelId,
  onPick,
  people,
  rows,
}: {
  personnelId: string;
  onPick: (id: string) => void;
  people: Array<{ id: string; fullName: string }>;
  rows: Array<{ type: string; entitled: number; used: number; remaining: number }>;
}) {
  const qc = useQueryClient();
  const [entitled, setEntitled] = useState(26);
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      leavesApi.setBalance({
        personnelId,
        year: thisYear,
        type: 'annual',
        entitledDays: entitled,
      }),
    onSuccess: async () => {
      setError(null);
      await qc.invalidateQueries({ queryKey: ['leave-balance'] });
    },
    onError: (e) => setError(describeError(e)),
  });

  return (
    <section className="card">
      <h3>ماندهٔ مرخصی (سالِ {faYear(thisYear)} میلادی)</h3>

      <label>
        کارمند
        <select value={personnelId} onChange={(e) => onPick(e.target.value)}>
          <option value="">انتخاب کنید…</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.fullName}
            </option>
          ))}
        </select>
      </label>

      {error && <p className="error">{error}</p>}

      {personnelId && (
        <>
          {rows.length === 0 ? (
            <p className="hint">
              سقفی تعیین نشده و مرخصیِ تأییدشده‌ای هم نیست.
            </p>
          ) : (
            <dl className="info-list">
              {rows.map((r) => (
                <div key={r.type}>
                  <dt>{TYPE_LABELS[r.type] ?? r.type}</dt>
                  <dd>
                    {fa(r.remaining)} از {fa(r.entitled)} روز
                    <span className="hint"> (مصرف: {fa(r.used)})</span>
                  </dd>
                </div>
              ))}
            </dl>
          )}

          <label>
            سقفِ مرخصیِ استحقاقی (روز)
            <input
              type="number"
              min={0}
              value={entitled}
              onChange={(e) => setEntitled(Number(e.target.value) || 0)}
            />
          </label>
          <p className="hint">
            سقف را واحدِ منابع انسانی تعیین می‌کند؛ سامانه سیاستِ مرخصی را
            حدس نمی‌زند. مصرف از مرخصی‌های تأییدشده حساب می‌شود.
          </p>
          <button
            type="button"
            disabled={save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? 'در حال ذخیره…' : 'ذخیرهٔ سقف'}
          </button>
        </>
      )}
    </section>
  );
}

/** فرمِ ثبتِ درخواستِ مرخصی. */
function NewLeaveForm({
  onClose,
  people,
}: {
  onClose: () => void;
  people: Array<{ id: string; fullName: string }>;
}) {
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    personnelId: '',
    type: 'annual',
    fromDate: '',
    toDate: '',
    reason: '',
    days: 0.5,
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const save = useMutation({
    mutationFn: () =>
      leavesApi.create({
        personnelId: form.personnelId,
        type: form.type,
        fromDate: form.fromDate,
        toDate: form.toDate,
        reason: form.reason,
        // فقط مرخصیِ ساعتی عددِ روز را از کاربر می‌گیرد؛ بقیه سمتِ سرور
        // از بازه حساب می‌شوند.
        ...(form.type === 'hourly' ? { days: form.days } : {}),
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['hr-summary'] });
      await qc.invalidateQueries({ queryKey: ['leaves'] });
      onClose();
    },
    onError: (e) => setError(describeError(e)),
  });

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-label="ثبتِ مرخصی"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="section-head">
          <h3>ثبتِ درخواستِ مرخصی</h3>
          <button type="button" className="link-button" onClick={onClose}>
            بستن
          </button>
        </div>

        {error && <p className="error">{error}</p>}

        <label>
          کارمند
          <select
            value={form.personnelId}
            onChange={(e) => set('personnelId', e.target.value)}
          >
            <option value="">انتخاب کنید…</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fullName}
              </option>
            ))}
          </select>
        </label>

        <div className="grid-2">
          <label>
            نوع
            <select
              value={form.type}
              onChange={(e) => set('type', e.target.value)}
            >
              {Object.entries(TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          {form.type === 'hourly' && (
            <label>
              معادلِ روز
              <input
                type="number"
                step={0.25}
                min={0}
                value={form.days}
                onChange={(e) => set('days', Number(e.target.value) || 0)}
              />
            </label>
          )}
        </div>

        <div className="grid-2">
          <label>
            از تاریخ
            <input
              type="date"
              value={form.fromDate}
              onChange={(e) => set('fromDate', e.target.value)}
            />
          </label>
          <label>
            تا تاریخ
            <input
              type="date"
              value={form.toDate}
              onChange={(e) => set('toDate', e.target.value)}
            />
          </label>
        </div>

        <label>
          دلیل
          <textarea
            rows={2}
            value={form.reason}
            onChange={(e) => set('reason', e.target.value)}
          />
        </label>

        <div className="inline-form">
          <button
            type="button"
            disabled={
              !form.personnelId ||
              !form.fromDate ||
              !form.toDate ||
              save.isPending
            }
            onClick={() => save.mutate()}
          >
            {save.isPending ? 'در حال ثبت…' : 'ثبتِ درخواست'}
          </button>
        </div>
      </div>
    </div>
  );
}
