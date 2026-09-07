import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { reportsApi } from '../../api';
import { QuestionCharts } from './QuestionCharts';

interface Props {
  formId: string;
}

type Tab = 'charts' | 'table';

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

export function ResponsesPanel({ formId }: Props) {
  const [tab, setTab] = useState<Tab>('charts');
  const [advancedExport, setAdvancedExport] = useState(false);

  const summary = useQuery({
    queryKey: ['summary', formId],
    queryFn: () => reportsApi.summary(formId),
  });

  const responses = useQuery({
    queryKey: ['responses', formId],
    queryFn: () => reportsApi.responses(formId),
  });

  const analytics = useQuery({
    queryKey: ['analytics', formId],
    queryFn: () => reportsApi.analytics(formId),
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
      </div>

      {tab === 'charts' && (
        <>
          {analytics.isLoading && <p>در حال ساخت نمودارها…</p>}
          {analytics.data && <QuestionCharts data={analytics.data} />}
        </>
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
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>پاسخ‌دهنده</th>
                  <th>وضعیت</th>
                  {questionIds.map((id) => (
                    <th key={id}>{titleOf(id)}</th>
                  ))}
                  <th>شاخص‌ها</th>
                </tr>
              </thead>
              <tbody>
                {responses.data?.map((row) => (
                  <tr key={row.id}>
                    <td>{row.respondentKey ?? '—'}</td>
                    <td>
                      {row.status === 'completed' ? 'تکمیل‌شده' : 'ناتمام'}
                    </td>
                    {questionIds.map((id) => (
                      <td key={id}>{formatAnswer(row.answers?.[id])}</td>
                    ))}
                    <td>
                      {Object.entries(row.scores ?? {})
                        .map(([key, value]) => `${key}: ${value}`)
                        .join('، ') || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function formatAnswer(value: unknown): string {
  if (value == null) return '—';
  if (Array.isArray(value)) return value.join('، ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
