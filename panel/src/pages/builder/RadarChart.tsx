import type { FormAnalytics } from '../../types';

type Score = FormAnalytics['scores'][number];

const SIZE = 340;
const CENTER = SIZE / 2;
/** شعاع خودِ نمودار؛ فاصله‌ی باقی‌مانده تا لبه برای برچسب شاخص‌هاست. */
const RADIUS = 108;
const RINGS = [25, 50, 75, 100];

/**
 * نمودار رادار شاخص‌ها.
 *
 * هر پرتو یک شاخص است و فاصله‌اش از مرکز «نرخ شاخص» — یعنی میانگین به‌صورت
 * درصدی از سقف. چون همه‌ی پرتوها درصدند، شاخص‌هایی با سقف متفاوت (۵ و ۱۰ و
 * ۱۰۰) روی یک شکل قابل مقایسه می‌شوند؛ همان چیزی که با چیپ‌های جدا شدنی نبود.
 *
 * مثل بقیه‌ی نمودارهای این پنل، بدون کتابخانه و با SVG ساده کشیده می‌شود.
 */
export function RadarChart({ scores }: { scores: Score[] }) {
  /*
   * فقط شاخص‌هایی که سقف دارند می‌توانند روی رادار بیایند.
   *
   * بدون سقف، «نرخ» تعریف نشده است و اگر عدد خام را بگذاریم، شاخصی با سقف
   * ۱۰۰ همیشه کل شکل را پر می‌کند و شاخص‌های ۰ تا ۱۰ به مرکز می‌چسبند —
   * نموداری که به‌جای مقایسه، گمراه می‌کند.
   */
  const axes = scores.filter(
    (score): score is Score & { rate: number } => score.rate !== null,
  );

  /*
   * رادار با کمتر از سه پرتو شکل نمی‌سازد: دو پرتو یک خط می‌شود و یکی یک
   * نقطه. در آن حالت چیپ‌های بالای صفحه خودشان گویاترند.
   */
  if (axes.length < 3) return null;

  const point = (index: number, ratio: number) => {
    // از بالا شروع می‌شود تا اولین شاخص در راس شکل بنشیند، نه در کنار.
    const angle = (index / axes.length) * 2 * Math.PI - Math.PI / 2;
    const r = RADIUS * Math.min(1, Math.max(0, ratio));
    return [CENTER + r * Math.cos(angle), CENTER + r * Math.sin(angle)];
  };

  const polygon = (ratio: number) =>
    axes
      .map((_, i) => point(i, ratio).map((n) => n.toFixed(1)).join(','))
      .join(' ');

  const shape = axes
    .map((score, i) =>
      point(i, score.rate / 100)
        .map((n) => n.toFixed(1))
        .join(','),
    )
    .join(' ');

  return (
    <section className="card radar-card">
      <h3>نمای کلی شاخص‌ها</h3>
      <p className="hint">
        هر پرتو یک شاخص است و فاصله‌اش از مرکز، درصد آن شاخص از سقفش. هرچه شکل
        پرتر و منظم‌تر باشد، عملکرد یکدست‌تر است.
      </p>

      <div className="radar-wrap">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="radar"
          role="img"
          aria-label={`نمودار رادار ${axes.length} شاخص`}
        >
          {RINGS.map((ring) => (
            <polygon
              key={ring}
              className="radar-ring"
              points={polygon(ring / 100)}
            />
          ))}

          {axes.map((score, i) => {
            const [x, y] = point(i, 1);
            return (
              <line
                key={score.key}
                className="radar-axis"
                x1={CENTER}
                y1={CENTER}
                x2={x}
                y2={y}
              />
            );
          })}

          <polygon className="radar-shape" points={shape} />

          {axes.map((score, i) => {
            const [x, y] = point(i, score.rate / 100);
            return <circle key={score.key} className="radar-dot" cx={x} cy={y} r={3.5} />;
          })}

          {axes.map((score, i) => {
            const [x, y] = point(i, 1);
            /*
             * چسباندن برچسب به سمت بیرونِ همان پرتو.
             *
             * بدون تنظیم text-anchor، برچسب‌های چپ و راست روی خود شکل
             * می‌افتادند و با اسم‌های فارسیِ بلند ناخوانا می‌شدند.
             */
            const dx = x - CENTER;
            const anchor =
              Math.abs(dx) < 12 ? 'middle' : dx > 0 ? 'start' : 'end';
            const labelX = x + (anchor === 'middle' ? 0 : dx > 0 ? 8 : -8);
            const labelY = y + (y < CENTER ? -8 : 14);

            return (
              <text
                key={score.key}
                className="radar-label"
                x={labelX}
                y={labelY}
                textAnchor={anchor}
              >
                {score.key}
                <tspan className="radar-label-value" dx="4">
                  {score.rate}٪
                </tspan>
              </text>
            );
          })}
        </svg>
      </div>
    </section>
  );
}
