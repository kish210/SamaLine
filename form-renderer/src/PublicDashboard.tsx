import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { dashboardApi } from './api';

interface WidgetData {
  id: string;
  type: 'stat' | 'bar' | 'nps' | 'text' | 'score';
  title: string;
  layout: { x: number; y: number; w: number; h: number };
  value?: number | string;
  series?: Array<{ label: string; count: number }>;
  content?: string;
  /** ویجتِ «پاسخ‌های اخیر». */
  rows?: Array<{
    responseId: string;
    submittedAt: string | null;
    score?: number | null;
    summary: string;
  }>;
  /** ویجتِ «نظرهای متنی». */
  quotes?: Array<{ responseId: string; text: string; at: string | null }>;
  error?: string;
}

/**
 * نمای فقط‌خواندنی داشبورد عمومی (بند ۸ سند).
 *
 * در رندرر است نه پنل، چون گیرنده‌ی لینک لازم نیست حساب کاربری داشته
 * باشد و نباید بسته‌ی سنگین پنل را دانلود کند.
 */
export function PublicDashboard() {
  const { publicToken } = useParams();
  const [data, setData] = useState<{
    name: string;
    widgets: WidgetData[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!publicToken) return;
    dashboardApi
      .getPublic(publicToken)
      .then(setData)
      .catch(() => setError('این داشبورد در دسترس نیست.'));
  }, [publicToken]);

  if (error) return <div className="container error">{error}</div>;
  if (!data) return <div className="container">در حال بارگذاری…</div>;

  return (
    <div className="container dashboard-view">
      <h2>{data.name}</h2>

      {data.widgets.length === 0 && (
        <p className="hint">این داشبورد ویجتی ندارد.</p>
      )}

      <div className="widget-grid">
        {data.widgets.map((widget) => {
          const max = Math.max(1, ...(widget.series ?? []).map((s) => s.count));
          return (
            <div
              key={widget.id}
              className="widget"
              style={{
                gridColumn: `span ${Math.min(12, Math.max(2, widget.layout.w))}`,
              }}
            >
              <h4>{widget.title}</h4>

              {widget.error ? (
                <p className="hint">{widget.error}</p>
              ) : widget.type === 'text' ? (
                <p className="widget-text">{widget.content}</p>
              ) : widget.rows ? (
                /* نمای عمومی فقط می‌خواند؛ drill-down ندارد چون ورود ندارد. */
                widget.rows.length === 0 ? (
                  <p className="hint">پاسخی در این بازه نیست.</p>
                ) : (
                  <ul className="widget-rows">
                    {widget.rows.map((r) => (
                      <li key={r.responseId}>
                        <span>{r.summary}</span>
                        {r.score !== null && r.score !== undefined && (
                          <strong> — {r.score}</strong>
                        )}
                      </li>
                    ))}
                  </ul>
                )
              ) : widget.quotes ? (
                widget.quotes.length === 0 ? (
                  <p className="hint">نظری ثبت نشده است.</p>
                ) : (
                  <ul className="widget-quotes">
                    {widget.quotes.map((q) => (
                      <li key={q.responseId}>«{q.text}»</li>
                    ))}
                  </ul>
                )
              ) : widget.series ? (
                <>
                  {widget.value !== undefined && (
                    <div className="widget-stat">
                      <strong>{widget.value}</strong>
                    </div>
                  )}
                  {widget.series.slice(0, 12).map((item) => (
                    <div key={item.label} className="bar-row">
                      <span className="bar-label">{item.label}</span>
                      <div className="bar-track">
                        <div
                          className="bar-fill"
                          style={{ width: `${(item.count / max) * 100}%` }}
                        />
                      </div>
                      <span className="bar-count">{item.count}</span>
                    </div>
                  ))}
                </>
              ) : (
                <div className="widget-stat">
                  <strong>{widget.value ?? 0}</strong>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
