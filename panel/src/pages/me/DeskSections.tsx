import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  cmmsApi,
  describeError,
  meApi,
  type MyDesk,
  type MyAttentionItem,
} from '../../api';
import { isoToJalaliText } from '../../jalali';

const fa = (n: number) => n.toLocaleString('fa-IR');

const TONE_COLORS: Record<string, string> = {
  info: 'var(--accent, #2563eb)',
  warn: '#b45309',
  danger: '#b91c1c',
};

const TASK_STATUS: Record<string, string> = {
  draft: 'بی‌متصدی',
  assigned: 'ارجاع‌شده به شما',
  in_progress: 'در حالِ انجام',
  waiting_parts: 'منتظرِ قطعه',
  waiting_contractor: 'منتظرِ پیمانکار',
  completed: 'تکمیل‌شده، منتظرِ تأیید',
  verified: 'تأییدشده',
  closed: 'بسته',
  cancelled: 'لغوشده',
};

const REQUEST_STATUS: Record<string, string> = {
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
};

const LEAVE_STATUS: Record<string, string> = {
  pending: 'منتظرِ تأیید',
  approved: 'تأییدشده',
  rejected: 'ردشده',
  cancelled: 'لغوشده',
};

const LEAVE_TYPE: Record<string, string> = {
  annual: 'استحقاقی',
  sick: 'استعلاجی',
  unpaid: 'بی‌حقوق',
  mission: 'مأموریت',
  hourly: 'ساعتی',
  other: 'سایر',
};

const ATTENDANCE_STATUS: Record<string, string> = {
  present: 'حاضر',
  late: 'تأخیر',
  absent: 'غایب',
  on_leave: 'مرخصی',
  off: 'تعطیل',
};

const hours = (minutes: number) => {
  if (minutes <= 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${fa(m)} دقیقه`;
  return m === 0 ? `${fa(h)} ساعت` : `${fa(h)} ساعت و ${fa(m)} دقیقه`;
};

/** گذارهایی که خودِ تکنسین می‌تواند بزند — آینهٔ قواعدِ سرور. */
const MY_TASK_ACTIONS: Record<string, { to: string; label: string }> = {
  assigned: { to: 'in_progress', label: 'شروعِ کار' },
  in_progress: { to: 'completed', label: 'تکمیل' },
};

/**
 * بخش‌های میزِ کارِ شخصی.
 *
 * هر عدد کارِ خودِ کاربر است و با دکمه‌ها همان‌جا پیش می‌رود: کار را شروع
 * و تکمیل می‌کند، خرابی اعلام می‌کند، مرخصی می‌گیرد. چیزی که فقط نمایش
 * باشد و راهِ اقدام نداشته باشد، همان داشبوردِ بی‌استفاده‌ی قبلی است.
 */
export function DeskSections({ desk }: { desk: MyDesk }) {
  const qc = useQueryClient();
  const [reporting, setReporting] = useState(false);
  const [askingLeave, setAskingLeave] = useState(false);

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ['my-desk'] });
    await qc.invalidateQueries({ queryKey: ['letters-unread'] });
  };

  const advance = useMutation({
    mutationFn: ({ id, to }: { id: string; to: string }) =>
      cmmsApi.setWorkOrderStatus(id, to, 'از داشبورد من'),
    onSuccess: refresh,
  });

  const attention = desk.attention ?? [];

  return (
    <>
      <section className="card">
        <div className="section-head">
          <h3>الان چه کاری با من است؟</h3>
          <span className="question-actions">
            <button type="button" onClick={() => setReporting(true)}>
              اعلامِ خرابی
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => setAskingLeave(true)}
            >
              درخواستِ مرخصی
            </button>
          </span>
        </div>

        {(desk.degraded ?? []).length > 0 && (
          <p className="error">
            این بخش‌ها الان خوانده نشدند: {(desk.degraded ?? []).join('، ')}.
            بقیهٔ عددها درست‌اند.
          </p>
        )}

        {attention.length === 0 ? (
          <p className="hint">
            چیزی روی دوشِ شما نیست: نه کارِ عقب‌افتاده، نه نامهٔ نخوانده.
          </p>
        ) : (
          <ul className="attention-list">
            {attention.map((item: MyAttentionItem) => (
              <li key={item.key}>
                <span className="attention-row">
                  <span
                    className="attention-count"
                    style={{ color: TONE_COLORS[item.tone] }}
                  >
                    {fa(item.count)}
                  </span>
                  <span className="attention-text">{item.text}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* شیفت و حضورِ امروز */}
      <section className="card" id="attendance">
        <div className="section-head">
          <h3>امروزِ من</h3>
          <span className="hint">
            {desk.date ? isoToJalaliText(desk.date) : ''}
          </span>
        </div>
        <dl className="info-list">
          <dt>شیفتِ امروز</dt>
          <dd>
            {(desk.shifts?.today ?? []).length === 0
              ? 'شیفتی ثبت نشده'
              : (desk.shifts?.today ?? [])
                  .map(
                    (s) =>
                      `${s.startTime} تا ${s.endTime}${
                        s.label ? ` (${s.label})` : ''
                      }`,
                  )
                  .join('، ')}
          </dd>
          <dt>حضورِ امروز</dt>
          <dd>
            {desk.attendance?.today
              ? `${
                  ATTENDANCE_STATUS[desk.attendance.today.status] ??
                  desk.attendance.today.status
                } — ${desk.attendance.today.checkIn || '—'} تا ${
                  desk.attendance.today.checkOut || '—'
                }`
              : 'ثبت نشده'}
          </dd>
          <dt>کارکردِ امروز</dt>
          <dd>{hours(desk.attendance?.today?.minutesWorked ?? 0)}</dd>
          <dt>کارکردِ ۳۰ روزِ گذشته</dt>
          <dd>{hours(desk.attendance?.month.minutesWorked ?? 0)}</dd>
        </dl>
        <p className="hint">
          ثبتِ ورود و خروج از ربات انجام می‌شود؛ در بخشِ «حساب‌های پیام‌رسانِ
          من» پیام‌رسانتان را وصل کنید.
        </p>
      </section>

      {/* کارهای من */}
      <section className="card" id="tasks">
        <div className="section-head">
          <h3>کارهای من</h3>
          <span className="hint">
            {fa(desk.tasks?.open ?? 0)} کارِ باز
            {(desk.tasks?.overdue ?? 0) > 0 && (
              <span style={{ color: TONE_COLORS.danger }}>
                {' '}
                · {fa(desk.tasks?.overdue ?? 0)} عقب‌افتاده
              </span>
            )}
          </span>
        </div>

        {advance.isError && (
          <p className="error">{describeError(advance.error)}</p>
        )}

        {(desk.tasks?.rows ?? []).length === 0 ? (
          <p className="hint">کارِ بازی به شما سپرده نشده است.</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>شماره</th>
                  <th>عنوان</th>
                  <th>وضعیت</th>
                  <th>موعد</th>
                  <th>اقدام</th>
                </tr>
              </thead>
              <tbody>
                {(desk.tasks?.rows ?? []).map((t) => {
                  const action = MY_TASK_ACTIONS[t.status];
                  return (
                    <tr key={t.id}>
                      <td>{t.number}</td>
                      <td>
                        {t.title}
                        {t.priority === 'emergency' && (
                          <span style={{ color: TONE_COLORS.danger }}>
                            {' '}
                            · اضطراری
                          </span>
                        )}
                      </td>
                      <td>{TASK_STATUS[t.status] ?? t.status}</td>
                      <td>
                        {t.dueDate ? (
                          <span
                            style={{
                              color: t.isOverdue
                                ? TONE_COLORS.danger
                                : 'inherit',
                            }}
                          >
                            {isoToJalaliText(t.dueDate)}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        {action && (
                          <button
                            type="button"
                            disabled={advance.isPending}
                            onClick={() =>
                              advance.mutate({ id: t.id, to: action.to })
                            }
                          >
                            {action.label}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* درخواست‌های من */}
      <section className="card">
        <div className="section-head">
          <h3>خرابی‌هایی که اعلام کرده‌ام</h3>
          <span className="hint">{fa(desk.requests?.total ?? 0)} مورد</span>
        </div>
        {(desk.requests?.rows ?? []).length === 0 ? (
          <p className="hint">
            خرابی‌ای اعلام نکرده‌اید. با دکمهٔ «اعلامِ خرابی» بالا ثبت کنید.
          </p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>شماره</th>
                  <th>عنوان</th>
                  <th>وضعیت</th>
                </tr>
              </thead>
              <tbody>
                {(desk.requests?.rows ?? []).map((r) => (
                  <tr key={r.id}>
                    <td>{r.number}</td>
                    <td>{r.title}</td>
                    <td>{REQUEST_STATUS[r.status] ?? r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* مرخصیِ من */}
      <section className="card">
        <div className="section-head">
          <h3>مرخصیِ من</h3>
          <span className="hint">
            {(desk.leaves?.pending ?? 0) > 0
              ? `${fa(desk.leaves?.pending ?? 0)} منتظرِ تأیید`
              : 'چیزی منتظرِ تأیید نیست'}
          </span>
        </div>

        {(desk.leaves?.balance ?? []).length > 0 && (
          <dl className="info-list">
            {(desk.leaves?.balance ?? []).map((b) => (
              <div key={b.type} style={{ display: 'contents' }}>
                <dt>ماندهٔ {LEAVE_TYPE[b.type] ?? b.type}</dt>
                <dd>
                  {fa(b.remainingDays)} روز از {fa(b.entitledDays)}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {(desk.leaves?.rows ?? []).length === 0 ? (
          <p className="hint">مرخصی‌ای ثبت نکرده‌اید.</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>شماره</th>
                  <th>نوع</th>
                  <th>از</th>
                  <th>تا</th>
                  <th>روز</th>
                  <th>وضعیت</th>
                </tr>
              </thead>
              <tbody>
                {(desk.leaves?.rows ?? []).map((l) => (
                  <tr key={l.id}>
                    <td>{l.number}</td>
                    <td>{LEAVE_TYPE[l.type] ?? l.type}</td>
                    <td>{isoToJalaliText(l.fromDate)}</td>
                    <td>{isoToJalaliText(l.toDate)}</td>
                    <td>{fa(l.days)}</td>
                    <td>{LEAVE_STATUS[l.status] ?? l.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* برنامهٔ هفته */}
      {(desk.shifts?.week ?? []).length > 0 && (
        <section className="card">
          <h3>شیفت‌های هفتهٔ پیشِ‌رو</h3>
          <ul>
            {(desk.shifts?.week ?? []).map((s) => (
              <li key={s.id}>
                {isoToJalaliText(s.date)} — {s.startTime} تا {s.endTime}
                {s.label && <span className="hint"> ({s.label})</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* اطلاعیه‌ها */}
      {(desk.announcements ?? []).length > 0 && (
        <section className="card">
          <div className="section-head">
            <h3>اطلاعیه‌ها</h3>
            <span className="hint">عمومی و بخشِ خودتان</span>
          </div>
          <ul>
            {(desk.announcements ?? []).map((a) => (
              <li key={a.id}>
                <strong>{a.title}</strong>
                {a.body && <div className="hint">{a.body}</div>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {reporting && (
        <ReportFaultForm
          onClose={() => setReporting(false)}
          onSaved={() => void refresh()}
        />
      )}
      {askingLeave && (
        <RequestLeaveForm
          onClose={() => setAskingLeave(false)}
          onSaved={() => void refresh()}
        />
      )}
    </>
  );
}

/** اعلامِ خرابی — همان مسیرِ درخواستِ تعمیرِ CMMS. */
function ReportFaultForm({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    location: '',
    category: 'other',
    priority: 'normal',
  });

  const rooms = useQuery({
    queryKey: ['cmms-rooms-for-fault'],
    queryFn: () => cmmsApi.assets({ pageSize: 1 }),
    enabled: false,
  });
  void rooms;

  const save = useMutation({
    mutationFn: () =>
      cmmsApi.createRequest({
        title: form.title.trim(),
        description: form.description.trim(),
        location: form.location.trim(),
        category: form.category,
        priority: form.priority,
      } as never),
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-label="اعلامِ خرابی"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="section-head">
          <h3>اعلامِ خرابی</h3>
          <button type="button" className="link-button" onClick={onClose}>
            بستن
          </button>
        </div>

        <label>
          چه چیزی خراب است؟ *
          <input
            value={form.title}
            placeholder="مثلاً: کولرِ اتاق ۲۰۳ کار نمی‌کند"
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
        </label>
        <label>
          محل
          <input
            value={form.location}
            placeholder="اتاق، طبقه یا بخش"
            onChange={(e) =>
              setForm((f) => ({ ...f, location: e.target.value }))
            }
          />
        </label>
        <label>
          دسته
          <select
            value={form.category}
            onChange={(e) =>
              setForm((f) => ({ ...f, category: e.target.value }))
            }
          >
            <option value="electrical">برق</option>
            <option value="plumbing">لوله‌کشی</option>
            <option value="hvac">تهویه و تأسیسات</option>
            <option value="carpentry">نجاری</option>
            <option value="painting">نقاشی</option>
            <option value="furniture">مبلمان</option>
            <option value="network">شبکه / تلفن / تلویزیون</option>
            <option value="door_lock">قفل و کارت</option>
            <option value="other">سایر</option>
          </select>
        </label>
        <label>
          اولویت
          <select
            value={form.priority}
            onChange={(e) =>
              setForm((f) => ({ ...f, priority: e.target.value }))
            }
          >
            <option value="low">کم</option>
            <option value="normal">عادی</option>
            <option value="high">زیاد</option>
            <option value="emergency">اضطراری</option>
          </select>
        </label>
        <label>
          توضیح
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
          />
        </label>

        {save.isError && <p className="error">{describeError(save.error)}</p>}
        <div className="inline-form">
          <button
            type="button"
            disabled={save.isPending || !form.title.trim()}
            onClick={() => save.mutate()}
          >
            {save.isPending ? 'در حال ثبت…' : 'ثبتِ خرابی'}
          </button>
        </div>
      </div>
    </div>
  );
}

/** درخواستِ مرخصیِ خودم. */
function RequestLeaveForm({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    fromDate: '',
    toDate: '',
    type: 'annual',
    reason: '',
  });

  const save = useMutation({
    mutationFn: () =>
      meApi.requestLeave({
        fromDate: form.fromDate,
        toDate: form.toDate,
        type: form.type,
        reason: form.reason.trim(),
      }),
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-label="درخواستِ مرخصی"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="section-head">
          <h3>درخواستِ مرخصی</h3>
          <button type="button" className="link-button" onClick={onClose}>
            بستن
          </button>
        </div>

        <div className="form-grid">
          <label>
            از تاریخ *
            <input
              type="date"
              value={form.fromDate}
              onChange={(e) =>
                setForm((f) => ({ ...f, fromDate: e.target.value }))
              }
            />
          </label>
          <label>
            تا تاریخ *
            <input
              type="date"
              value={form.toDate}
              onChange={(e) =>
                setForm((f) => ({ ...f, toDate: e.target.value }))
              }
            />
          </label>
          <label>
            نوع
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            >
              <option value="annual">استحقاقی</option>
              <option value="sick">استعلاجی</option>
              <option value="unpaid">بی‌حقوق</option>
              <option value="hourly">ساعتی</option>
              <option value="mission">مأموریت</option>
              <option value="other">سایر</option>
            </select>
          </label>
        </div>
        <label>
          علت
          <textarea
            rows={2}
            value={form.reason}
            onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
          />
        </label>

        <p className="hint">
          {form.fromDate && form.toDate
            ? `از ${isoToJalaliText(form.fromDate)} تا ${isoToJalaliText(
                form.toDate,
              )}`
            : 'تاریخ‌ها میلادی انتخاب می‌شوند و شمسیِ معادل همین‌جا نشان داده می‌شود.'}
        </p>

        {save.isError && <p className="error">{describeError(save.error)}</p>}
        <div className="inline-form">
          <button
            type="button"
            disabled={save.isPending || !form.fromDate || !form.toDate}
            onClick={() => save.mutate()}
          >
            {save.isPending ? 'در حال ثبت…' : 'ثبتِ درخواست'}
          </button>
          <Link className="link-button" to="/leaves">
            کارتابلِ مرخصی
          </Link>
        </div>
      </div>
    </div>
  );
}
