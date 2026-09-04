import type { WidgetData } from '../../api';

interface Props {
  widget: WidgetData;
  onRemove?: () => void;
  onResize?: (delta: -1 | 1) => void;
}

const METRIC_LABELS: Record<string, string> = {
  visits: 'بازدید',
  started: 'شروع‌شده',
  completed: 'تکمیل‌شده',
  completionRate: 'نرخ تکمیل',
};

/** یک ویجت روی داشبورد؛ نمودار با SVG بومی رسم می‌شود. */
export function WidgetCard({ widget, onRemove, onResize }: Props) {
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
