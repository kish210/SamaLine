import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { aiApi, describeError, reportsApi, responsesApi } from '../../api';
import type { ResponseRow } from '../../types';
import { useAuth } from '../../auth';
import { hasRole } from '../../types';
import { isoToJalaliText } from '../../jalali';
import { QuestionCharts } from './QuestionCharts';
import { DateRangeFilter, type DateRange } from './DateRangeFilter';

/** وضعیتِ بررسیِ یک درخواست، ذخیره‌شده داخلِ `meta.review`. */
interface ReviewMeta {
  status?: 'pending' | 'approved' | 'rejected';
  byEmail?: string;
  at?: string;
  note?: string;
  requestedAt?: string;
}

const REVIEW_LABELS: Record<string, string> = {
  pending: 'در انتظار تأیید',
  approved: 'تأییدشده',
  rejected: 'ردشده',
};

function reviewOf(meta: Record<string, unknown> | undefined): ReviewMeta | null {
  const review = meta?.review;
  return review && typeof review === 'object'
    ? (review as ReviewMeta)
    : null;
}

interface Props {
  formId: string;
  /** عنوان فرم؛ روی سربرگ گزارش چاپی می‌نشیند. */
  formTitle: string;
}

type Tab = 'charts' | 'table' | 'ai';
type StatusFilter = 'all' | 'completed' | 'partial';

/** تعداد ردیف در هر صفحه‌ی جدول پاسخ‌ها. */
const PAGE_SIZE = 25;

/** برچسب فارسی نوع انتشار (منبعِ پاسخ). */
const SOURCE_LABELS: Record<string, string> = {
  link: 'لینک',
  sms: 'پیامک',
  email: 'ایمیل',
  kiosk: 'کیوسک',
  portal: 'پرتال',
  iframe: 'آی‌فریم',
  api: 'API',
};

function sourceLabel(meta: Record<string, unknown> | undefined): string {
  const source = meta?.source;
  if (typeof source !== 'string' || !source) return '—';
  return SOURCE_LABELS[source] ?? source;
}

/**
 * تاریخ و ساعت شمسی از یک ISO.
 *
 * تابع تاریخِ موجود فقط روز را می‌دهد؛ در جدول پاسخ‌ها ساعت هم لازم است تا دو
 * پاسخ در یک روز از هم قابل تشخیص باشند.
 */
function jalaliDateTime(iso: string | null): string {
  if (!iso) return '—';
  const date = isoToJalaliText(iso);
  if (!date) return '—';
  const time = new Date(iso).toLocaleTimeString('fa-IR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${date} ${time}`;
}

/** داشبورد فرم و جدول پاسخ‌نامه‌ها (بند ۸ سند). */
/**
 * مدت زمان به شکل خوانا.
 *
 * ثانیه‌ی خام برای زمان‌های چنددقیقه‌ای خوانده نمی‌شود؛ «۵:۴۴» یا «۴۴ ثانیه»
 * فوری فهمیده می‌شود.
 */
function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return '—';
  if (seconds < 60) return `${Math.round(seconds)} ثانیه`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

export function ResponsesPanel({ formId, formTitle }: Props) {
  const [tab, setTab] = useState<Tab>('charts');
  const [range, setRange] = useState<DateRange>({});
  const [advancedExport, setAdvancedExport] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  /** پاسخ‌نامه‌ای که نمای کاملش باز است. */
  const [detail, setDetail] = useState<ResponseRow | null>(null);

  const summary = useQuery({
    queryKey: ['summary', formId],
    queryFn: () => reportsApi.summary(formId),
  });

  const responses = useQuery({
    queryKey: ['responses', formId],
    queryFn: () => reportsApi.responses(formId),
  });

  const analytics = useQuery({
    queryKey: ['analytics', formId, range.from, range.to],
    queryFn: () => reportsApi.analytics(formId, range),
  });

  // ستون‌های جدول از کلید پاسخ‌ها استخراج می‌شود چون ساختار فرم
  // ممکن است بین نسخه‌ها تغییر کرده باشد.
  const questionIds = useMemo(() => {
    const ids = new Set<string>();
    for (const row of responses.data ?? []) {
      Object.keys(row.answers ?? {}).forEach((key) => ids.add(key));
    }
    return [...ids];
  }, [responses.data]);

  /*
   * فیلتر و جستجو روی داده‌ی بارگذاری‌شده انجام می‌شود، نه با درخواست تازه.
   *
   * اندپوینت حداکثر ۵۰۰ ردیف می‌دهد و همه یک‌جا در دست است؛ فیلترِ سمت مرورگر
   * فوری است و به هر تایپ، رفت‌وبرگشت سرور اضافه نمی‌کند. جستجو روی متنِ همه‌ی
   * پاسخ‌های یک ردیف است تا «هر جوابی که این کلمه را دارد» پیدا شود.
   */
  const filtered = useMemo(() => {
    const rows = responses.data ?? [];
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter === 'completed' && row.status !== 'completed') {
        return false;
      }
      if (statusFilter === 'partial' && row.status === 'completed') {
        return false;
      }
      if (!needle) return true;
      const haystack = [
        row.respondentKey ?? '',
        ...Object.values(row.answers ?? {}).map((v) => formatAnswer(v)),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [responses.data, statusFilter, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // اگر فیلتر تعداد را کم کرد و صفحه‌ی فعلی دیگر وجود ندارد، به صفحه‌ی آخر برگرد.
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  );

  /**
   * عنوان خوانای هر سوال برای سرستون جدول.
   *
   * پیش از این شناسه‌ی خام (`h_airport`) سرستون بود و جدول عملاً خوانده
   * نمی‌شد. عنوان‌ها از همان تجمیعی می‌آید که نمودارها را می‌سازد.
   */
  const titleOf = useMemo(() => {
    const map = new Map(
      (analytics.data?.questions ?? []).map((q) => [q.id, q.title]),
    );
    return (id: string) => map.get(id) ?? id;
  }, [analytics.data]);

  return (
    <div className="report-tab">
      <div className="stat-row">
        <div className="stat">
          <span className="stat-value">{summary.data?.views ?? 0}</span>
          <span className="stat-label">بازدید</span>
        </div>
        <div className="stat">
          <span className="stat-value">{summary.data?.started ?? 0}</span>
          <span className="stat-label">شروع‌شده</span>
        </div>
        <div className="stat">
          <span className="stat-value">{summary.data?.completed ?? 0}</span>
          <span className="stat-label">تکمیل‌شده</span>
        </div>
        <div className="stat">
          <span className="stat-value">{summary.data?.responseRate ?? 0}٪</span>
          <span className="stat-label">نرخ پاسخگویی</span>
        </div>
        <div className="stat">
          <span className="stat-value">
            {summary.data?.completionRate ?? 0}٪
          </span>
          <span className="stat-label">نرخ تکمیل</span>
        </div>
        <div className="stat">
          <span className="stat-value">
            {formatDuration(summary.data?.averageDurationSeconds)}
          </span>
          <span className="stat-label">میانگین زمان پاسخ</span>
        </div>
      </div>

      <div className="report-tabs">
        <button
          type="button"
          className={tab === 'charts' ? 'active' : ''}
          onClick={() => setTab('charts')}
        >
          نمودارها
        </button>
        <button
          type="button"
          className={tab === 'table' ? 'active' : ''}
          onClick={() => setTab('table')}
        >
          جدول پاسخ‌ها
        </button>
        <button
          type="button"
          className={tab === 'ai' ? 'active' : ''}
          onClick={() => setTab('ai')}
        >
          تحلیل هوش مصنوعی
        </button>

        <div className="tabs-spacer" />

        <button
          type="button"
          className="secondary print-button"
          onClick={() => window.print()}
          disabled={!analytics.data}
          title="در پنجره‌ی چاپ، «ذخیره به‌صورت PDF» را انتخاب کنید"
        >
          خروجی PDF
        </button>
      </div>

      {tab === 'charts' && (
        <>
          <DateRangeFilter value={range} onChange={setRange} />
          {analytics.isLoading && <p>در حال ساخت نمودارها…</p>}
          {analytics.data && (
            <QuestionCharts data={analytics.data} formTitle={formTitle} />
          )}
        </>
      )}

      {tab === 'ai' && (
        <AiAnswerAnalysis
          questions={analytics.data?.questions ?? []}
          rows={responses.data ?? []}
        />
      )}

      <section className="card" hidden={tab !== 'table'}>
        <div className="section-head">
          <h3>پاسخ‌نامه‌ها</h3>
          <div className="inline-form">
            <label className="checkbox">
              <input
                type="checkbox"
                checked={advancedExport}
                onChange={(e) => setAdvancedExport(e.target.checked)}
              />
              خروجی پیشرفته (متادیتا)
            </label>
            <button
              type="button"
              className="secondary"
              onClick={() =>
                void reportsApi.download(formId, 'xlsx', advancedExport)
              }
            >
              اکسل
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() =>
                void reportsApi.download(formId, 'csv', advancedExport)
              }
            >
              CSV
            </button>
          </div>
        </div>
        {responses.isLoading && <p>در حال بارگذاری…</p>}
        {responses.data?.length === 0 && (
          <p className="empty">هنوز پاسخی ثبت نشده است.</p>
        )}

        {(responses.data?.length ?? 0) > 0 && (
          <>
            <div className="table-toolbar">
              <div className="quick-filter">
                {(
                  [
                    ['all', 'همه'],
                    ['completed', 'کامل'],
                    ['partial', 'ناقص'],
                  ] as Array<[StatusFilter, string]>
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={statusFilter === key ? 'active' : ''}
                    onClick={() => {
                      setStatusFilter(key);
                      setPage(0);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <input
                className="table-search"
                type="search"
                placeholder="جستجو در پاسخ‌ها…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
              />

              <span className="table-count">
                {filtered.length} از {responses.data?.length} پاسخ
              </span>
            </div>

            {filtered.length === 0 ? (
              <p className="empty">پاسخی با این فیلتر پیدا نشد.</p>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>تاریخ</th>
                      <th>پاسخ‌دهنده</th>
                      <th>منبع</th>
                      <th>وضعیت</th>
                      <th>مدت</th>
                      {questionIds.map((id) => (
                        <th key={id}>{titleOf(id)}</th>
                      ))}
                      <th>شاخص‌ها</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((row) => (
                      <tr key={row.id}>
                        <td className="nowrap">
                          {jalaliDateTime(row.submittedAt ?? row.createdAt)}
                        </td>
                        <td>{row.respondentKey ?? '—'}</td>
                        <td className="nowrap">{sourceLabel(row.meta)}</td>
                        <td>
                          <span
                            className={
                              row.status === 'completed'
                                ? 'badge-status done'
                                : 'badge-status partial'
                            }
                          >
                            {row.status === 'completed' ? 'کامل' : 'ناقص'}
                          </span>
                          {(() => {
                            const rv = reviewOf(row.meta);
                            return rv ? (
                              <span
                                className={`review-badge ${rv.status ?? 'pending'}`}
                              >
                                {REVIEW_LABELS[rv.status ?? 'pending'] ??
                                  rv.status}
                              </span>
                            ) : null;
                          })()}
                        </td>
                        <td className="nowrap">
                          {formatDuration(row.durationSeconds)}
                        </td>
                        {questionIds.map((id) => (
                          <td key={id}>{formatAnswer(row.answers?.[id])}</td>
                        ))}
                        <td>
                          {Object.entries(row.scores ?? {})
                            .map(([key, value]) => `${key}: ${value}`)
                            .join('، ') || '—'}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="secondary row-view"
                            title="نمای کامل پاسخ‌نامه"
                            onClick={() => setDetail(row)}
                          >
                            نمایش
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {pageCount > 1 && (
              <div className="pager">
                <button
                  type="button"
                  className="secondary"
                  disabled={safePage === 0}
                  onClick={() => setPage(safePage - 1)}
                >
                  ← قبلی
                </button>
                <span>
                  صفحه {safePage + 1} از {pageCount}
                </span>
                <button
                  type="button"
                  className="secondary"
                  disabled={safePage >= pageCount - 1}
                  onClick={() => setPage(safePage + 1)}
                >
                  بعدی →
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {detail && (
        <ResponseDetail
          row={detail}
          formId={formId}
          titleOf={titleOf}
          questionIds={questionIds}
          onClose={() => setDetail(null)}
          onReviewed={(updated) => setDetail(updated)}
        />
      )}
    </div>
  );
}

/**
 * نمای کامل یک پاسخ‌نامه.
 *
 * جدول پهن است و در آن همه‌ی سوال‌ها ستون‌اند؛ برای خواندن یک پاسخِ خاص،
 * دیدنِ همه‌ی جواب‌هایش زیر هم بسیار خواناتر از افقی اسکرول کردن است.
 */
function ResponseDetail({
  row,
  formId,
  titleOf,
  questionIds,
  onClose,
  onReviewed,
}: {
  row: ResponseRow;
  formId: string;
  titleOf: (id: string) => string;
  questionIds: string[];
  onClose: () => void;
  onReviewed: (updated: ResponseRow) => void;
}) {
  const queryClient = useQueryClient();
  const me = useAuth((s) => s.user);
  // تأیید/رد یک تصمیمِ مدیریتی است؛ بیننده/تحلیل‌گر فقط می‌خواند.
  const canReview = hasRole(me?.role ?? null, 'editor');
  const review = reviewOf(row.meta);
  const [note, setNote] = useState(review?.note ?? '');

  // سوال‌هایی که در این پاسخ جوابی دارند، به ترتیب ستون‌های جدول.
  const answered = questionIds.filter(
    (id) => row.answers?.[id] !== undefined && row.answers?.[id] !== null,
  );

  const decide = useMutation({
    mutationFn: (decision: 'approved' | 'rejected') =>
      responsesApi.review(row.id, { decision, note: note.trim() }),
    onSuccess: async (updated) => {
      onReviewed(updated);
      await queryClient.invalidateQueries({ queryKey: ['responses', formId] });
    },
  });

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-label="نمای کامل پاسخ‌نامه"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="section-head">
          <h3>پاسخ‌نامه</h3>
          <button type="button" className="secondary" onClick={onClose}>
            بستن
          </button>
        </div>

        <dl className="detail-meta">
          <div>
            <dt>تاریخ</dt>
            <dd>{jalaliDateTime(row.submittedAt ?? row.createdAt)}</dd>
          </div>
          <div>
            <dt>وضعیت</dt>
            <dd>{row.status === 'completed' ? 'کامل' : 'ناقص'}</dd>
          </div>
          <div>
            <dt>مدت پاسخ</dt>
            <dd>{formatDuration(row.durationSeconds)}</dd>
          </div>
          <div>
            <dt>منبع</dt>
            <dd>{sourceLabel(row.meta)}</dd>
          </div>
          {row.respondentKey && (
            <div>
              <dt>پاسخ‌دهنده</dt>
              <dd>{row.respondentKey}</dd>
            </div>
          )}
          {typeof row.meta?.ip === 'string' && (
            <div>
              <dt>IP</dt>
              <dd>{row.meta.ip as string}</dd>
            </div>
          )}
        </dl>

        <dl className="detail-answers">
          {answered.map((id) => (
            <div key={id}>
              <dt>{titleOf(id)}</dt>
              <dd>{formatAnswer(row.answers?.[id])}</dd>
            </div>
          ))}
        </dl>

        {Object.keys(row.scores ?? {}).length > 0 && (
          <dl className="detail-answers scores">
            {Object.entries(row.scores).map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        )}

        {review && (
          <div className="review-box">
            <div className="review-head">
              <span>گردش‌کارِ تأیید</span>
              <span className={`review-badge ${review.status ?? 'pending'}`}>
                {REVIEW_LABELS[review.status ?? 'pending'] ?? review.status}
              </span>
            </div>
            {review.byEmail && review.status !== 'pending' && (
              <p className="review-by">
                {review.status === 'approved' ? 'تأیید' : 'رد'} توسطِ{' '}
                {review.byEmail}
                {review.at ? ` — ${jalaliDateTime(review.at)}` : ''}
              </p>
            )}
            {canReview ? (
              <>
                <textarea
                  className="review-note"
                  placeholder="یادداشتِ بررسی (اختیاری)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                />
                <div className="review-actions">
                  <button
                    type="button"
                    disabled={decide.isPending}
                    onClick={() => decide.mutate('approved')}
                  >
                    تأیید
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    disabled={decide.isPending}
                    onClick={() => decide.mutate('rejected')}
                  >
                    رد
                  </button>
                </div>
                {decide.isError && (
                  <p className="error">ثبتِ تصمیم ناموفق بود.</p>
                )}
              </>
            ) : (
              review.note && <p className="review-by">یادداشت: {review.note}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function formatAnswer(value: unknown): string {
  if (value == null) return '—';
  if (Array.isArray(value)) return value.join('، ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** نوعِ سوال‌هایی که پاسخِ متن‌بازِ قابل‌تحلیل دارند. */
const OPEN_TEXT_TYPES = new Set(['long_text', 'short_text']);

interface AiAnalysisResult {
  sentiment?: { positive?: number; neutral?: number; negative?: number };
  topics?: Array<{ label: string; count: number }>;
  summary?: string;
}

/**
 * تحلیلِ هوش مصنوعیِ پاسخ‌های متن‌بازِ یک سوال.
 *
 * پاسخ‌های یک سوالِ متن‌باز را از همه‌ی پاسخ‌نامه‌ها جمع می‌کند و به موتورِ
 * `analyze-open-text` می‌دهد؛ لحن، موضوع‌های پرتکرار و خلاصه را نشان می‌دهد.
 */
function AiAnswerAnalysis({
  questions,
  rows,
}: {
  questions: Array<{ id: string; title: string; type?: string }>;
  rows: ResponseRow[];
}) {
  const openQuestions = questions.filter((q) => OPEN_TEXT_TYPES.has(q.type ?? ''));
  const [questionId, setQuestionId] = useState<string>(openQuestions[0]?.id ?? '');

  const answersFor = (id: string): string[] =>
    rows
      .map((r) => r.answers?.[id])
      .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
      .map((v) => v.trim());

  const analyze = useMutation({
    mutationFn: () => aiApi.analyze(answersFor(questionId)),
  });
  const result = analyze.data as AiAnalysisResult | undefined;
  const count = questionId ? answersFor(questionId).length : 0;

  if (openQuestions.length === 0) {
    return (
      <section className="card">
        <h3>تحلیل هوش مصنوعی</h3>
        <p className="hint">
          این فرم سوالِ متن‌بازی (پاسخِ تشریحی) ندارد؛ تحلیلِ متن روی همین نوع
          سوال‌ها کار می‌کند.
        </p>
      </section>
    );
  }

  return (
    <section className="card">
      <h3>تحلیل هوش مصنوعیِ پاسخ‌های متن‌باز</h3>
      <div className="inline-form">
        <label className="inline-select">
          <span>سوال</span>
          <select value={questionId} onChange={(e) => setQuestionId(e.target.value)}>
            {openQuestions.map((q) => (
              <option key={q.id} value={q.id}>
                {q.title || q.id}
              </option>
            ))}
          </select>
        </label>
        <span className="hint">{count.toLocaleString('fa-IR')} پاسخِ متنی</span>
        <button
          type="button"
          disabled={analyze.isPending || count === 0}
          onClick={() => analyze.mutate()}
        >
          {analyze.isPending ? 'در حال تحلیل…' : 'تحلیل با هوش مصنوعی'}
        </button>
      </div>

      {analyze.isError && <p className="error">{describeError(analyze.error)}</p>}

      {result && (
        <div className="ai-analysis">
          {result.summary && (
            <p>
              <strong>خلاصه:</strong> {result.summary}
            </p>
          )}
          {result.sentiment && (
            <p className="hint">
              لحن — مثبت: {Number(result.sentiment.positive ?? 0).toLocaleString('fa-IR')} ·
              خنثی: {Number(result.sentiment.neutral ?? 0).toLocaleString('fa-IR')} ·
              منفی: {Number(result.sentiment.negative ?? 0).toLocaleString('fa-IR')}
            </p>
          )}
          {result.topics && result.topics.length > 0 && (
            <table className="simple-table">
              <thead>
                <tr>
                  <th>موضوع</th>
                  <th>تکرار</th>
                </tr>
              </thead>
              <tbody>
                {result.topics.map((t, i) => (
                  <tr key={i}>
                    <td>{t.label}</td>
                    <td>{Number(t.count ?? 0).toLocaleString('fa-IR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </section>
  );
}
