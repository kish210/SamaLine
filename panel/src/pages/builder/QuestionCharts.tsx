import type { AnalyticsQuestion, FormAnalytics } from '../../types';

/**
 * نمودارهای گزارش فرم.
 *
 * عمداً هیچ کتابخانه‌ی نموداری استفاده نشده: نمودارها میله‌ای و خطی ساده‌اند
 * و با CSS و یک SVG کوچک کشیده می‌شوند. یک کتابخانه‌ی نمودار چند صد کیلوبایت
 * به پنل اضافه می‌کرد بی‌آنکه چیزی بیشتر از این بدهد.
 */
export function QuestionCharts({ data }: { data: FormAnalytics }) {
  if (data.totalResponses === 0) {
    return (
      <section className="card">
        <p className="empty">
          هنوز پاسخ تکمیل‌شده‌ای نیست؛ با آمدن اولین پاسخ، نمودارها اینجا
          ساخته می‌شوند.
        </p>
      </section>
    );
  }

  return (
    <>
      {data.scores.length > 0 && (
        <section className="card">
          <h3>شاخص‌ها</h3>
          <div className="score-row">
            {data.scores.map((score) => (
              <div key={score.key} className="score-chip">
                <span className="score-value">{score.average}</span>
                <span className="score-key">{score.key}</span>
                <span className="score-count">
                  میانگین {score.count} پاسخ
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {data.trend.length > 1 && <TrendChart trend={data.trend} />}

      {data.questions.map((question) => (
        <QuestionCard key={question.id} question={question} />
      ))}
    </>
  );
}

function QuestionCard({ question }: { question: AnalyticsQuestion }) {
  return (
    <section className="card chart-card">
      <div className="chart-head">
        <h3>{question.title}</h3>
        <span className="chart-meta">
          {question.answered} پاسخ
          {question.skipped > 0 && ` · ${question.skipped} بی‌پاسخ`}
          {question.average !== null && ` · میانگین ${question.average}`}
        </span>
      </div>

      {question.answered === 0 ? (
        <p className="empty">به این سوال هنوز پاسخی داده نشده است.</p>
      ) : question.chart === 'nps' && question.nps ? (
        <NpsChart question={question} />
      ) : question.chart === 'text' ? (
        <TextSamples samples={question.samples} />
      ) : (
        <Bars question={question} />
      )}
    </section>
  );
}

function Bars({ question }: { question: AnalyticsQuestion }) {
  const max = Math.max(1, ...question.bars.map((b) => b.count));
  return (
    <div className="bars">
      {question.bars.map((bar) => (
        <div key={bar.label} className="bar-row">
          <span className="bar-label" title={bar.label}>
            {bar.label}
          </span>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{ width: `${(bar.count / max) * 100}%` }}
            />
          </div>
          <span className="bar-count">
            {bar.count} <small>({bar.percent}٪)</small>
          </span>
        </div>
      ))}
    </div>
  );
}

function NpsChart({ question }: { question: AnalyticsQuestion }) {
  const nps = question.nps;
  if (!nps) return null;
  const total = nps.promoters + nps.passives + nps.detractors || 1;
  const segments = [
    { key: 'detractors', label: 'منتقد (۰ تا ۶)', value: nps.detractors },
    { key: 'passives', label: 'خنثی (۷ و ۸)', value: nps.passives },
    { key: 'promoters', label: 'ترویج‌کننده (۹ و ۱۰)', value: nps.promoters },
  ];

  return (
    <div className="nps-chart">
      <div className="nps-score">
        <span className="nps-value">{nps.score}</span>
        <span className="nps-caption">امتیاز NPS</span>
      </div>

      <div className="nps-stack">
        {segments.map((segment) => (
          <div
            key={segment.key}
            className={`nps-seg ${segment.key}`}
            style={{ width: `${(segment.value / total) * 100}%` }}
            title={`${segment.label}: ${segment.value}`}
          />
        ))}
      </div>

      <ul className="nps-legend">
        {segments.map((segment) => (
          <li key={segment.key}>
            <i className={`dot ${segment.key}`} />
            {segment.label} — {segment.value}
          </li>
        ))}
      </ul>

      <Bars question={question} />
    </div>
  );
}

function TextSamples({ samples }: { samples: string[] }) {
  if (samples.length === 0) return <p className="empty">پاسخ متنی ثبت نشده.</p>;
  return (
    <ul className="text-samples">
      {samples.map((sample, index) => (
        <li key={`${index}-${sample.slice(0, 20)}`}>{sample}</li>
      ))}
    </ul>
  );
}

/**
 * نمودار خطی روند پاسخ‌ها.
 *
 * محور افقی تاریخ شمسی است — همان چیزی که کاربر در فرم می‌بیند. برچسب‌ها
 * از سرور آماده می‌آیند تا تبدیل تقویم یک‌بار و یک‌جا انجام شود.
 */
function TrendChart({ trend }: { trend: FormAnalytics['trend'] }) {
  const width = 640;
  const height = 180;
  const padding = { top: 12, right: 12, bottom: 28, left: 32 };
  const max = Math.max(1, ...trend.map((t) => t.started));
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  const x = (index: number) =>
    padding.left +
    (trend.length === 1 ? innerWidth / 2 : (index / (trend.length - 1)) * innerWidth);
  const y = (value: number) =>
    padding.top + innerHeight - (value / max) * innerHeight;

  const path = (pick: (t: FormAnalytics['trend'][number]) => number) =>
    trend.map((t, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(pick(t))}`).join(' ');

  // با ده‌ها روز، همه‌ی برچسب‌ها روی هم می‌افتند؛ فقط چند تا نشان داده می‌شود.
  const labelStep = Math.max(1, Math.ceil(trend.length / 6));

  return (
    <section className="card chart-card">
      <div className="chart-head">
        <h3>روند پاسخ‌ها</h3>
        <span className="chart-meta">
          <i className="dot started" /> شروع‌شده
          <i className="dot completed" /> تکمیل‌شده
        </span>
      </div>

      <div className="trend-scroll">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="trend-chart"
          role="img"
          aria-label="نمودار روند پاسخ‌ها"
        >
          <line
            x1={padding.left}
            y1={padding.top + innerHeight}
            x2={width - padding.right}
            y2={padding.top + innerHeight}
            className="axis"
          />
          <path d={path((t) => t.started)} className="line started" />
          <path d={path((t) => t.completed)} className="line completed" />

          {trend.map((point, index) => (
            <circle
              key={point.date}
              cx={x(index)}
              cy={y(point.completed)}
              r={2.5}
              className="point completed"
            >
              <title>{`${point.jalali}: ${point.completed} تکمیل‌شده از ${point.started}`}</title>
            </circle>
          ))}

          {trend.map((point, index) =>
            index % labelStep === 0 ? (
              <text
                key={point.date}
                x={x(index)}
                y={height - 8}
                className="tick"
                textAnchor="middle"
              >
                {point.jalali}
              </text>
            ) : null,
          )}

          <text x={padding.left - 6} y={padding.top + 8} className="tick" textAnchor="end">
            {max}
          </text>
        </svg>
      </div>
    </section>
  );
}
