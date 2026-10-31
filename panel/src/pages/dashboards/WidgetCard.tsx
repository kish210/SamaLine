import type { WidgetData } from '../../api';

interface Props {
  widget: WidgetData;
  onRemove?: () => void;
  onResize?: (delta: -1 | 1) => void;
  /** رفتن به خودِ پاسخ (drill-down) از ردیفِ جدول یا نظر. */
  onOpenResponse?: (responseId: string) => void;
}

const METRIC_LABELS: Record<string, string> = {
  visits: 'بازدید',
  started: 'شروع‌شده',
  completed: 'تکمیل‌شده',
  completionRate: 'نرخ تکمیل',
};

/** یک ویجت روی داشبورد؛ نمودار با SVG بومی رسم می‌شود. */
export function WidgetCard({
  widget,
  onRemove,
  onResize,
  onOpenResponse,
}: Props) {
  const maxCount = Math.max(1, ...(widget.series ?? []).map((s) => s.count));

  return (
    <div
      className="widget"
      style={{ gridColumn: `span ${Math.min(12, Math.max(2, widget.layout.w))}` }}
    >
      <div className="widget-head">
        <h4>{widget.title}</h4>
        {(onRemove || onResize) && (
          <div className="widget-actions">
            {onResize && (
              <>
                <button type="button" onClick={() => onResize(-1)} title="باریک‌تر">
                  −
                </button>
                <button type="button" onClick={() => onResize(1)} title="پهن‌تر">
                  +
                </button>
              </>
            )}
            {onRemove && (
              <button type="button" className="danger" onClick={onRemove}>
                حذف
              </button>
            )}
          </div>
        )}
      </div>

      {widget.error ? (
        <p className="warning-line">{widget.error}</p>
      ) : widget.type === 'text' ? (
        <p className="widget-text">{widget.content}</p>
      ) : widget.type === 'stat' ? (
        <div className="widget-stat">
          <span className="stat-value">{widget.value ?? 0}</span>
          <span className="stat-label">
            {METRIC_LABELS[widget.metric ?? ''] ?? widget.metric}
          </span>
        </div>
      ) : widget.type === 'score' ? (
        <div className="widget-stat">
          <span className="stat-value">{widget.value ?? 0}</span>
          <span className="stat-label">میانگین شاخص {widget.scoreKey}</span>
        </div>
      ) : widget.type === 'nps' ? (
        <div>
          <div className="widget-stat">
            <span className="stat-value">{widget.value ?? 0}</span>
            <span className="stat-label">شاخص NPS</span>
          </div>
          <Bars series={widget.series ?? []} max={maxCount} />
        </div>
      ) : widget.type === 'trend' ? (
        <div>
          <div className="widget-stat">
            <span className="stat-value">{widget.value ?? 0}</span>
            <span className="stat-label">
              پاسخ در بازه
              {/* جهتِ حرکت؛ همان چیزی که مدیر می‌پرسد. */}
              {typeof widget.changePercent === 'number' && (
                <strong
                  style={{
                    marginInlineStart: 8,
                    color:
                      widget.changePercent >= 0 ? '#15803d' : '#b91c1c',
                  }}
                >
                  {widget.changePercent >= 0 ? '▲' : '▼'}{' '}
                  {Math.abs(widget.changePercent)}٪
                </strong>
              )}
            </span>
          </div>
          <Bars series={widget.series ?? []} max={maxCount} />
        </div>
      ) : widget.type === 'table' ? (
        <TableRows rows={widget.rows ?? []} onOpen={onOpenResponse} />
      ) : widget.type === 'verbatim' ? (
        <Quotes quotes={widget.quotes ?? []} onOpen={onOpenResponse} />
      ) : (
        <Bars series={widget.series ?? []} max={maxCount} />
      )}
    </div>
  );
}

function Bars({
  series,
  max,
}: {
  series: Array<{ label: string; count: number }>;
  max: number;
}) {
  if (!series.length) return <p className="empty">داده‌ای نیست.</p>;

  return (
    <div className="bars">
      {series.slice(0, 12).map((item) => (
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
    </div>
  );
}


/** تاریخِ کوتاهِ شمسی؛ خالی یعنی هنوز ثبت نشده. */
function shortDate(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString('fa-IR') : '—';
}

/** ردیف‌های پاسخِ اخیر؛ هر ردیف به خودِ پاسخ می‌رسد. */
function TableRows({
  rows,
  onOpen,
}: {
  rows: NonNullable<WidgetData['rows']>;
  onOpen?: (responseId: string) => void;
}) {
  if (!rows.length) return <p className="empty">پاسخی در این بازه نیست.</p>;

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>تاریخ</th>
            <th>خلاصه</th>
            <th>امتیاز</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.responseId}
              onClick={() => onOpen?.(r.responseId)}
              style={{ cursor: onOpen ? 'pointer' : 'default' }}
              title={onOpen ? 'نمایشِ پاسخ' : undefined}
            >
              <td>{shortDate(r.submittedAt)}</td>
              <td>{r.summary}</td>
              <td>{r.score ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** نظرهای متنیِ اخیر؛ ارزشمندترین محتوای نظرسنجی. */
function Quotes({
  quotes,
  onOpen,
}: {
  quotes: NonNullable<WidgetData['quotes']>;
  onOpen?: (responseId: string) => void;
}) {
  if (!quotes.length) return <p className="empty">نظری ثبت نشده است.</p>;

  return (
    <ul className="widget-quotes">
      {quotes.map((q) => (
        <li
          key={q.responseId}
          onClick={() => onOpen?.(q.responseId)}
          style={{
            cursor: onOpen ? 'pointer' : 'default',
            padding: '0.4rem 0',
            borderBottom: '1px solid var(--border, #e5e7eb)',
          }}
        >
          <span>«{q.text}»</span>
          <small style={{ opacity: 0.7, marginInlineStart: 8 }}>
            {shortDate(q.at)}
          </small>
        </li>
      ))}
    </ul>
  );
}
