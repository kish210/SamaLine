import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  departmentsApi,
  describeError,
  hrApi,
  leavesApi,
  shiftsApi,
  type DayBoardRow,
  type ShiftTemplate,
} from '../api';
import { isoToJalaliText } from '../jalali';

/** برچسبِ فارسیِ وضعیتِ حضور. */
const STATUS_LABELS: Record<string, string> = {
  present: 'حاضر',
  late: 'تأخیر',
  absent: 'غایب',
  on_leave: 'مرخصی',
  off: 'تعطیل',
};

const STATUS_COLORS: Record<string, string> = {
  present: '#15803d',
  late: '#b45309',
  absent: '#b91c1c',
  on_leave: 'var(--accent, #2563eb)',
  off: 'inherit',
};

const fa = (n: number) => n.toLocaleString('fa-IR');

/** امروز به‌شکلِ YYYY-MM-DD (UTC، مثلِ ستونِ تاریخِ سرور). */
const todayIso = () => new Date().toISOString().slice(0, 10);

/** `days` روز بعد از یک تاریخِ ISO. */
const addDays = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86400000)
    .toISOString()
    .slice(0, 10);

/** دقیقه به «۸ ساعت و ۳۰ دقیقه». */
const hours = (minutes: number) => {
  if (minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${fa(m)} دقیقه`;
  return m === 0 ? `${fa(h)} ساعت` : `${fa(h)} ساعت و ${fa(m)} دقیقه`;
};

/** کدام ردیف‌ها با این صافی می‌مانند. */
type BoardFilter =
  | 'all'
  | 'scheduled'
  | 'present'
  | 'late'
  | 'absent'
  | 'onLeave'
  | 'unrecorded';

const FILTER_LABELS: Record<BoardFilter, string> = {
  all: 'کلِ پرسنل',
  scheduled: 'شیفت‌دارِ امروز',
  present: 'حاضر',
  late: 'با تأخیر',
  absent: 'غایب',
  onLeave: 'در مرخصی',
  unrecorded: 'حضورِ ثبت‌نشده',
};

const matches = (row: DayBoardRow, filter: BoardFilter): boolean => {
  switch (filter) {
    case 'scheduled':
      return row.shifts.length > 0;
    case 'present':
      return row.attendance?.status === 'present';
    case 'late':
      return row.attendance?.status === 'late';
    case 'absent':
      return row.attendance?.status === 'absent';
    case 'onLeave':
      return row.onLeave;
    case 'unrecorded':
      return row.shifts.length > 0 && !row.onLeave && !row.attendance;
    default:
      return true;
  }
};

/**
 * میزِ کارِ پرسنل.
 *
 * یک صفحه به جایِ سه: «امروز قرار بود چه کسی کار کند، چه کسی آمد، و چه
 * چیزی ناتمام است؟» شیفت، حضور و مرخصی در یک جدول کنار هم‌اند، و هر عددِ
 * بالا با کلیک همان ردیف‌ها را فیلتر می‌کند — نه آمارِ تزئینی.
 */
export function WorkforcePage() {
  const qc = useQueryClient();
  const [date, setDate] = useState(todayIso());

  /*
   * صافیِ آماده از داشبوردِ مدیریت (`?filter=unrecorded`).
   *
   * مقدارِ ناشناخته نادیده گرفته می‌شود تا لینکِ کهنه صفحه را خالی نکند.
   */
  const [params] = useSearchParams();
  const wanted = params.get('filter');
  const [filter, setFilter] = useState<BoardFilter>(
    wanted && wanted in FILTER_LABELS ? (wanted as BoardFilter) : 'all',
  );
  const [assigning, setAssigning] = useState<DayBoardRow | null>(null);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  /* واحد و جست‌وجو: با ۲۰۰ نفر، پیدا کردنِ یک نفر در جدول سخت بود. */
  const [departmentId, setDepartmentId] = useState(
    params.get('department') ?? '',
  );
  const [search, setSearch] = useState('');

  const board = useQuery({
    queryKey: ['shift-day', date, departmentId],
    queryFn: () => shiftsApi.day(date, departmentId || undefined),
    refetchOnWindowFocus: true,
  });

  const departments = useQuery({
    queryKey: ['departments'],
    queryFn: departmentsApi.list,
  });

  /*
   * ماندهٔ مرخصیِ همه در یک درخواست (نه per-row). سالِ میلادی، مثلِ خودِ
   * سرویس؛ UI همان عدد را نشان می‌دهد.
   */
  const balances = useQuery({
    queryKey: ['leave-balances', new Date().getFullYear()],
    queryFn: () => leavesApi.balances(new Date().getFullYear()),
  });

  const leaveSummary = useQuery({
    queryKey: ['hr-summary'],
    queryFn: leavesApi.summary,
  });

  const templates = useQuery({
    queryKey: ['shift-templates'],
    queryFn: shiftsApi.templates,
  });

  /** شمارِ شیفت‌های هفتهٔ پیشِ‌رو، برای ستونِ کنار. */
  const week = useQuery({
    queryKey: ['shift-roster-week', date],
    queryFn: () => shiftsApi.roster(date, addDays(date, 6)),
  });

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ['shift-day'] });
    await qc.invalidateQueries({ queryKey: ['shift-roster-week'] });
  };

  const setAttendance = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      shiftsApi.setAttendance({ ...body, date }),
    onSuccess: refresh,
  });

  const removeShift = useMutation({
    mutationFn: (id: string) => shiftsApi.removeAssignment(id),
    onSuccess: refresh,
  });

  const totals = board.data?.totals;
  const needle = search.trim().toLowerCase();
  const rows = (board.data?.rows ?? [])
    .filter((r) => matches(r, filter))
    .filter((r) =>
      needle
        ? `${r.fullName} ${r.position ?? ''}`.toLowerCase().includes(needle)
        : true,
    );

  /** کاشی‌های بالای صفحه؛ هر کدام یک صافیِ واقعیِ جدول است. */
  const tiles: Array<{ key: BoardFilter; label: string; count: number; tone?: string }> =
    totals
      ? [
          { key: 'all', label: 'پرسنلِ فعال', count: totals.people },
          { key: 'scheduled', label: 'شیفتِ امروز', count: totals.scheduled },
          {
            key: 'present',
            label: 'حاضر',
            count: totals.present,
            tone: STATUS_COLORS.present,
          },
          {
            key: 'late',
            label: 'تأخیر',
            count: totals.late,
            tone: STATUS_COLORS.late,
          },
          {
            key: 'absent',
            label: 'غایب',
            count: totals.absent,
            tone: STATUS_COLORS.absent,
          },
          {
            key: 'onLeave',
            label: 'در مرخصی',
            count: totals.onLeave,
            tone: STATUS_COLORS.on_leave,
          },
          {
            key: 'unrecorded',
            label: 'حضورِ ثبت‌نشده',
            count: totals.unrecorded,
            tone: '#b45309',
          },
        ]
      : [];

  return (
    <div className="page">
      <header className="page-header">
        <h1>میزِ کارِ پرسنل</h1>
        <div className="header-actions">
          <button type="button" onClick={() => setDate(addDays(date, -1))}>
            روزِ پیش
          </button>
          <button
            type="button"
            className="secondary"
            disabled={date === todayIso()}
            onClick={() => setDate(todayIso())}
          >
            امروز
          </button>
          <button type="button" onClick={() => setDate(addDays(date, 1))}>
            روزِ بعد
          </button>
          {/* حضوروغیابِ همین هفتهٔ نمایش‌داده‌شده. */}
          <button
            type="button"
            className="secondary"
            onClick={() =>
              void hrApi.exportXlsx('attendance', {
                from: date,
                to: addDays(date, 6),
              })
            }
          >
            خروجی حضوروغیاب
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => setTemplatesOpen((v) => !v)}
          >
            {templatesOpen ? 'بستنِ الگوها' : 'الگوی شیفت'}
          </button>
        </div>
      </header>

      <p className="hint">
        {isoToJalaliText(date)}
        {date !== todayIso() && ' (روزِ گذشته/آینده)'}
      </p>

      {board.isLoading && <p>در حال بارگذاری…</p>}
      {board.isError && (
        <p className="error">خواندنِ برنامهٔ روز ناموفق بود.</p>
      )}

      {totals && (
        <section className="card">
          <div className="section-head">
            <h3>وضعیتِ امروز</h3>
            <span className="hint">روی هر عدد بزنید تا جدول فیلتر شود</span>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(9rem, 1fr))',
              gap: '0.6rem',
            }}
          >
            {tiles.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setFilter(t.key)}
                style={{
                  textAlign: 'start',
                  padding: '0.6rem 0.7rem',
                  borderRadius: 10,
                  cursor: 'pointer',
                  border: `1px solid ${
                    filter === t.key
                      ? t.tone ?? 'var(--accent, #2563eb)'
                      : 'var(--border, #d4d4d8)'
                  }`,
                  background:
                    filter === t.key
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
                    color: t.count > 0 ? t.tone ?? 'inherit' : 'inherit',
                    opacity: t.count > 0 ? 1 : 0.45,
                  }}
                >
                  {fa(t.count)}
                </div>
                <div style={{ fontSize: '0.82rem', opacity: 0.85 }}>
                  {t.label}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {templatesOpen && <ShiftTemplates templates={templates.data ?? []} />}

      <div className="builder-layout">
        <div className="builder">
          <section className="card">
            <div className="section-head">
              <h3>{FILTER_LABELS[filter]}</h3>
              <span className="question-actions">
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  aria-label="صافیِ واحد"
                  style={{ width: 'auto' }}
                >
                  <option value="">همهٔ واحدها</option>
                  {(departments.data ?? []).map((dep) => (
                    <option key={dep.id} value={dep.id}>
                      {dep.name}
                    </option>
                  ))}
                </select>
                <input
                  type="search"
                  value={search}
                  placeholder="جست‌وجوی نام…"
                  aria-label="جست‌وجوی پرسنل"
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ width: '12rem' }}
                />
                {filter !== 'all' && (
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => setFilter('all')}
                  >
                    نمایشِ همه
                  </button>
                )}
              </span>
            </div>

            {setAttendance.isError && (
              <p className="error">{describeError(setAttendance.error)}</p>
            )}

            {rows.length === 0 ? (
              <p className="hint">موردی با این صافی نیست.</p>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>پرسنل</th>
                      <th>شیفت</th>
                      <th>وضعیت</th>
                      <th>ورود / خروج</th>
                      <th>کارکرد</th>
                      <th>ماندهٔ مرخصی</th>
                      <th>ثبت</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.personnelId}>
                        <td>
                          {r.fullName}
                          {r.position && (
                            <span className="hint"> — {r.position}</span>
                          )}
                        </td>
                        <td>
                          {r.shifts.length === 0 ? (
                            <span className="hint">بی‌شیفت</span>
                          ) : (
                            <span className="question-actions">
                              {r.shifts.map((s) => (
                                <button
                                  key={s.id}
                                  type="button"
                                  title="حذفِ این شیفت"
                                  disabled={removeShift.isPending}
                                  onClick={() => removeShift.mutate(s.id)}
                                >
                                  {s.label || 'شیفت'} {s.startTime}–{s.endTime} ✕
                                </button>
                              ))}
                            </span>
                          )}
                        </td>
                        <td>
                          {r.onLeave ? (
                            <strong style={{ color: STATUS_COLORS.on_leave }}>
                              مرخصی
                            </strong>
                          ) : r.attendance ? (
                            <strong
                              style={{
                                color:
                                  STATUS_COLORS[r.attendance.status] ??
                                  'inherit',
                              }}
                            >
                              {STATUS_LABELS[r.attendance.status] ??
                                r.attendance.status}
                            </strong>
                          ) : (
                            <span className="hint">ثبت نشده</span>
                          )}
                        </td>
                        <td>
                          {r.attendance?.checkIn || '—'}
                          {' / '}
                          {r.attendance?.checkOut || '—'}
                        </td>
                        <td>{hours(r.attendance?.minutesWorked ?? 0)}</td>
                        <td>
                          {(() => {
                            const b =
                              balances.data?.balances[r.personnelId];
                            if (!b) return <span className="hint">—</span>;
                            return (
                              <span
                                title={`سقف ${b.entitled} · مصرفِ ${b.used} روز`}
                              >
                                {b.remaining.toLocaleString('fa-IR')} روز
                              </span>
                            );
                          })()}
                        </td>
                        <td>
                          <span className="question-actions">
                            <button
                              type="button"
                              disabled={setAttendance.isPending || r.onLeave}
                              title={
                                r.onLeave
                                  ? 'در مرخصیِ تأییدشده است'
                                  : 'ثبتِ حاضر'
                              }
                              onClick={() =>
                                setAttendance.mutate({
                                  personnelId: r.personnelId,
                                  status: 'present',
                                  checkIn:
                                    r.shifts[0]?.startTime ||
                                    new Date().toISOString().slice(11, 16),
                                })
                              }
                            >
                              حاضر
                            </button>
                            <button
                              type="button"
                              disabled={setAttendance.isPending || r.onLeave}
                              onClick={() =>
                                setAttendance.mutate({
                                  personnelId: r.personnelId,
                                  status: 'absent',
                                })
                              }
                            >
                              غایب
                            </button>
                            {r.attendance?.checkIn &&
                              !r.attendance?.checkOut && (
                                <button
                                  type="button"
                                  disabled={setAttendance.isPending}
                                  onClick={() =>
                                    setAttendance.mutate({
                                      personnelId: r.personnelId,
                                      checkOut:
                                        r.shifts[0]?.endTime ||
                                        new Date()
                                          .toISOString()
                                          .slice(11, 16),
                                    })
                                  }
                                >
                                  خروج
                                </button>
                              )}
                            <button
                              type="button"
                              onClick={() => setAssigning(r)}
                            >
                              + شیفت
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
          <section className="card">
            <h3>مرخصی</h3>
            {leaveSummary.data ? (
              <>
                <dl className="info-list">
                  {leaveSummary.data.buckets.map((b) => (
                    <div key={b.key} style={{ display: 'contents' }}>
                      <dt>{b.label}</dt>
                      <dd>{fa(b.count)}</dd>
                    </div>
                  ))}
                  <dt>نیروی فعال</dt>
                  <dd>{fa(leaveSummary.data.headcount)}</dd>
                </dl>
                <Link className="link-button" to="/leaves">
                  رفتن به کارتابلِ مرخصی
                </Link>
              </>
            ) : (
              <p className="hint">در حال بارگذاری…</p>
            )}
          </section>

          <section className="card">
            <h3>هفتهٔ پیشِ‌رو</h3>
            {week.data && week.data.length > 0 ? (
              <ul>
                {Array.from({ length: 7 }, (_, i) => addDays(date, i)).map(
                  (day) => {
                    const count = (week.data ?? []).filter(
                      (s) => s.date === day,
                    ).length;
                    return (
                      <li key={day}>
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => setDate(day)}
                        >
                          {isoToJalaliText(day)}
                        </button>{' '}
                        — {count > 0 ? `${fa(count)} شیفت` : 'بی‌برنامه'}
                      </li>
                    );
                  },
                )}
              </ul>
            ) : (
              <p className="hint">برنامه‌ای برای این هفته ثبت نشده است.</p>
            )}
          </section>
        </div>
      </div>

      {assigning && (
        <AssignShiftForm
          row={assigning}
          date={date}
          templates={templates.data ?? []}
          onClose={() => setAssigning(null)}
          onSaved={() => void refresh()}
        />
      )}
    </div>
  );
}

/** مدیریتِ الگوهای شیفت. */
function ShiftTemplates({ templates }: { templates: ShiftTemplate[] }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: '',
    startTime: '07:00',
    endTime: '15:00',
  });

  const save = useMutation({
    mutationFn: () => shiftsApi.createTemplate(form),
    onSuccess: async () => {
      setForm({ name: '', startTime: '07:00', endTime: '15:00' });
      await qc.invalidateQueries({ queryKey: ['shift-templates'] });
    },
  });

  const toggle = useMutation({
    mutationFn: (t: ShiftTemplate) =>
      shiftsApi.updateTemplate(t.id, { isActive: !t.isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shift-templates'] }),
  });

  return (
    <section className="card">
      <div className="section-head">
        <h3>الگوهای شیفت</h3>
        <span className="hint">
          ساعتِ الگو روی شیفتِ ثبت‌شده کپی می‌شود؛ ویرایشِ بعدیِ الگو برنامهٔ
          گذشته را عوض نمی‌کند.
        </span>
      </div>

      {templates.length > 0 && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>نام</th>
                <th>شروع</th>
                <th>پایان</th>
                <th>وضعیت</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td>{t.startTime}</td>
                  <td>
                    {t.endTime}
                    {t.endTime < t.startTime && (
                      <span className="hint"> (شبانه)</span>
                    )}
                  </td>
                  <td>{t.isActive ? 'فعال' : 'غیرفعال'}</td>
                  <td>
                    <button
                      type="button"
                      disabled={toggle.isPending}
                      onClick={() => toggle.mutate(t)}
                    >
                      {t.isActive ? 'غیرفعال' : 'فعال'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="inline-form">
        <input
          value={form.name}
          placeholder="نامِ شیفت (صبح)"
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <input
          type="time"
          value={form.startTime}
          onChange={(e) =>
            setForm((f) => ({ ...f, startTime: e.target.value }))
          }
        />
        <input
          type="time"
          value={form.endTime}
          onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
        />
        <button
          type="button"
          disabled={save.isPending || !form.name.trim()}
          onClick={() => save.mutate()}
        >
          افزودن
        </button>
      </div>
      {save.isError && <p className="error">{describeError(save.error)}</p>}
    </section>
  );
}

/** شیفت دادن به یک پرسنل، برای یک روز یا یک بازه. */
function AssignShiftForm({
  row,
  date,
  templates,
  onClose,
  onSaved,
}: {
  row: DayBoardRow;
  date: string;
  templates: ShiftTemplate[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const active = templates.filter((t) => t.isActive);
  const [templateId, setTemplateId] = useState(active[0]?.id ?? '');
  const [startTime, setStartTime] = useState('07:00');
  const [endTime, setEndTime] = useState('15:00');
  const [days, setDays] = useState('1');
  const [note, setNote] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  /*
   * چند روزِ پشتِ‌سرهم با یک فرم.
   *
   * برنامهٔ شیفت در عمل «این هفته صبح‌کار است» است، نه روزِ تک؛ بدونِ این،
   * سرشیفت باید هفت بار فرم را پر کند. روزِ تکراری یا هم‌پوشان رد می‌شود و
   * بقیهٔ روزها ثبت می‌شوند.
   */
  const save = useMutation({
    mutationFn: async () => {
      const count = Math.max(1, Math.min(Number(days || 1), 31));
      const failures: string[] = [];
      for (let i = 0; i < count; i += 1) {
        const day = new Date(Date.parse(`${date}T00:00:00Z`) + i * 86400000)
          .toISOString()
          .slice(0, 10);
        try {
          await shiftsApi.assign({
            personnelId: row.personnelId,
            date: day,
            ...(templateId ? { templateId } : { startTime, endTime }),
            note: note.trim(),
          });
        } catch (error) {
          failures.push(`${isoToJalaliText(day)}: ${describeError(error)}`);
        }
      }
      return failures;
    },
    onSuccess: (failures) => {
      onSaved();
      // اگر همه ثبت شد، فرم بسته می‌شود؛ وگرنه دلیلِ هر روز نشان داده می‌شود.
      if (failures.length === 0) onClose();
    },
  });

  const failures = save.data ?? [];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-label="ثبتِ شیفت"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="section-head">
          <h3>شیفتِ {row.fullName}</h3>
          <button type="button" className="link-button" onClick={onClose}>
            بستن
          </button>
        </div>

        <div className="form-grid">
          <label>
            الگو
            <select
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
            >
              <option value="">— ساعتِ دستی —</option>
              {active.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.startTime}–{t.endTime})
                </option>
              ))}
            </select>
          </label>
          {!templateId && (
            <>
              <label>
                شروع
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </label>
              <label>
                پایان
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </label>
            </>
          )}
          <label>
            چند روزِ پشتِ‌سرهم
            <input
              type="number"
              min={1}
              max={31}
              value={days}
              onChange={(e) => setDays(e.target.value)}
            />
          </label>
          <label>
            یادداشت
            <input value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
        </div>

        <p className="hint">از {isoToJalaliText(date)} شروع می‌شود.</p>

        {failures.length > 0 && (
          <div className="error">
            {failures.map((f) => (
              <div key={f}>{f}</div>
            ))}
          </div>
        )}
        {save.isError && <p className="error">{describeError(save.error)}</p>}

        <div className="inline-form">
          <button
            type="button"
            disabled={save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? 'در حال ثبت…' : 'ثبتِ شیفت'}
          </button>
        </div>
      </div>
    </div>
  );
}
