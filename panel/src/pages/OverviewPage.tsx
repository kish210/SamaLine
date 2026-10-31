import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  commandCenterApi,
  describeError,
  overviewApi,
  workspaceApi,
} from "../api";
import type { CommandDesk, ManagerOverview } from "../api";
import { isoToJalaliText } from "../jalali";

const fa = (n: number) => n.toLocaleString("fa-IR");
const faDigits = (s: string) => s.replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);

/** 'YYYY-MM-DD' (روزِ تهران) → «۰۱/۱۰» شمسی برای محورِ نمودار. */
function jalaliShort(day: string): string {
  const text = isoToJalaliText(`${day}T12:00:00Z`);
  return text ? faDigits(text.slice(5)) : day;
}

const PERIODS = [
  { days: 7, label: "۷ روز" },
  { days: 30, label: "۳۰ روز" },
  { days: 90, label: "۹۰ روز" },
];

const TONE_COLORS: Record<string, string> = {
  info: "var(--accent, #2563eb)",
  warn: "#b45309",
  danger: "#b91c1c",
};

/** نامِ فارسیِ بخشی که در پاسخ نیامده، برای پیامِ صریحِ «غایب». */
const DEGRADED_LABELS: Record<string, string> = {
  technical: "عملیاتِ فنی",
  workforce: "نیرویِ انسانی",
  leave: "مرخصی",
  rooms: "اتاق‌ها",
  inventory: "انبار",
};

/**
 * داشبوردِ مدیریت: یک نگاه به کلِ عملیاتِ هتل.
 *
 * کارت‌های شاخص، روندِ روزانه، تفکیکِ واحدها، وضعیتِ تأیید و پرکارترین فرم‌ها.
 * نمودارها عمدا بدون کتابخانه و با SVGِ ساده‌اند (همان روشِ بقیه‌ی پنل).
 */
export function OverviewPage() {
  const [days, setDays] = useState(30);

  const workspaces = useQuery({
    queryKey: ["workspaces"],
    queryFn: workspaceApi.list,
  });
  const workspaceId = workspaces.data?.[0]?.id ?? "";

  const overview = useQuery({
    queryKey: ["overview", workspaceId, days],
    queryFn: () => overviewApi.get(workspaceId, days),
    enabled: Boolean(workspaceId),
    refetchInterval: 5 * 60_000,
  });

  /*
   * میزِ فرماندهی مستقل از بازهٔ نظرسنجی است.
   *
   * «الان چه چیزی توجه می‌خواهد؟» بازه ندارد؛ کارِ اضطراریِ باز با عوض
   * کردنِ «۳۰ روز» به «۷ روز» عوض نمی‌شود. برای همین کوئریِ جدا دارد و با
   * دکمه‌های بازه دوباره خوانده نمی‌شود.
   */
  const desk = useQuery({
    queryKey: ["command-center"],
    queryFn: () => commandCenterApi.get(),
    refetchOnWindowFocus: true,
    refetchInterval: 2 * 60_000,
  });

  const data = overview.data;

  return (
    <div className="page overview-page">
      <header className="page-header">
        <h1>داشبوردِ مدیریت</h1>
        <div className="period-switch" role="group" aria-label="بازه">
          {PERIODS.map((p) => (
            <button
              key={p.days}
              type="button"
              className={p.days === days ? "active" : "secondary"}
              onClick={() => setDays(p.days)}
              aria-pressed={p.days === days}
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>

      {desk.isError && (
        <p className="error">خواندنِ وضعیتِ عملیات ناموفق بود.</p>
      )}
      {desk.data && <CommandDeskView desk={desk.data} />}

      <section className="card">
        <div className="section-head">
          <h3>بازخوردِ مهمان</h3>
          <span className="hint">
            {fa(data?.totals.current ?? 0)} گزارش در {fa(data?.days ?? 0)} روزِ
            اخیر
          </span>
        </div>
        <p className="hint">
          بخشِ زیر دربارهٔ فرم‌ها و نظرسنجی است و بازهٔ بالا رویش اثر دارد؛
          وضعیتِ عملیاتیِ بالا بازه ندارد.
        </p>
      </section>

      {overview.isError && (
        <p className="error">{describeError(overview.error)}</p>
      )}
      {overview.isLoading && <p>در حال بارگذاری…</p>}

      {data && (
        <>
          <KpiRow data={data} />

          <section className="card ov-trend">
            <div className="section-head">
              <h3>روندِ گزارش‌های روزانه</h3>
              <span className="hint">
                {fa(data.totals.current)} گزارش در {fa(data.days)} روزِ اخیر
              </span>
            </div>
            <TrendChart series={data.series} />
          </section>

          <div className="ov-grid">
            <section className="card">
              <div className="section-head">
                <h3>واحدها</h3>
                <Link to="/units" className="hint">
                  همه‌ی واحدها ←
                </Link>
              </div>
              <UnitBars units={data.byUnit} />
            </section>

            <section className="card">
              <div className="section-head">
                <h3>گردش‌کارِ تأیید</h3>
                <Link to="/approvals" className="hint">
                  کارتابل ←
                </Link>
              </div>
              <ReviewDonut review={data.review} />
            </section>

            <section className="card">
              <div className="section-head">
                <h3>پرکارترین فرم‌ها</h3>
              </div>
              <TopForms forms={data.topForms} />
            </section>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * میزِ فرماندهی: «الان چه چیزی توجه می‌خواهد؟»
 *
 * اول فهرستِ اولویت‌دار (تا مدیر برای فهمیدنِ اولویت پنج کاشی را با چشم
 * مقایسه نکند)، بعد عددهای هر دامنه. هر عدد لینک است و به همان فهرستِ
 * زیرین می‌رود؛ داشبوردی که نمی‌شود از آن به رکورد رسید همان «بی‌استفاده»
 * بودنِ قبلی است.
 */
function CommandDeskView({ desk }: { desk: CommandDesk }) {
  const calm = desk.attention.length === 0;

  return (
    <>
      <section className="card">
        <div className="section-head">
          <h3>الان چه چیزی توجه می‌خواهد؟</h3>
          <span className="hint">
            به‌روزرسانی:{" "}
            {new Date(desk.generatedAt).toLocaleTimeString("fa-IR")}
          </span>
        </div>

        {desk.degraded.length > 0 && (
          <p className="error">
            این بخش‌ها الان خوانده نشدند:{" "}
            {desk.degraded
              .map((d) => DEGRADED_LABELS[d] ?? d)
              .join("، ")}
            . بقیهٔ عددها درست‌اند.
          </p>
        )}

        {calm ? (
          <p className="hint">
            چیزی معلق نیست: نه کارِ اضطراری، نه حضورِ ثبت‌نشده، نه مرخصیِ
            منتظرِ تأیید.
          </p>
        ) : (
          <ul className="attention-list">
            {desk.attention.map((item) => (
              <li key={item.key}>
                <Link to={item.href} className="attention-row">
                  <span
                    className="attention-count"
                    style={{ color: TONE_COLORS[item.tone] }}
                  >
                    {fa(item.count)}
                  </span>
                  <span className="attention-text">{item.text}</span>
                  <span className="attention-go" aria-hidden="true">
                    ←
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {desk.sections.map((section) => (
        <section className="card" key={section.key}>
          <div className="section-head">
            <h3>{section.title}</h3>
            <Link to={section.href} className="hint">
              باز کردنِ میزِ کار ←
            </Link>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(9.5rem, 1fr))",
              gap: "0.6rem",
            }}
          >
            {section.tiles.map((tile) => (
              <Link
                key={tile.key}
                to={tile.href}
                style={{
                  textAlign: "start",
                  padding: "0.6rem 0.7rem",
                  borderRadius: 10,
                  border: "1px solid var(--border, #d4d4d8)",
                  color: "inherit",
                  textDecoration: "none",
                }}
              >
                <div
                  style={{
                    fontSize: "1.5rem",
                    fontWeight: 700,
                    lineHeight: 1.1,
                    color: tile.count > 0 ? TONE_COLORS[tile.tone] : "inherit",
                    opacity: tile.count > 0 ? 1 : 0.45,
                  }}
                >
                  {fa(tile.count)}
                </div>
                <div style={{ fontSize: "0.82rem", opacity: 0.85 }}>
                  {tile.label}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}

      {(desk.cost || desk.inventoryValue !== null) && (
        <div className="kpi-row">
          <div className="kpi-card">
            <span className="kpi-label">نیروی فعال</span>
            <span className="kpi-value">{fa(desk.headcount)}</span>
            <span className="kpi-delta neutral">پروندهٔ فعالِ پرسنل</span>
          </div>
          {desk.cost && (
            <div className="kpi-card">
              <span className="kpi-label">
                هزینهٔ نگهداریِ {fa(desk.cost.days)} روز
              </span>
              <span className="kpi-value">
                {fa(desk.cost.internal + desk.cost.contractor)}
              </span>
              <span className="kpi-delta neutral">
                ریال — {fa(desk.cost.internal)} داخلی ·{" "}
                {fa(desk.cost.contractor)} پیمانکار
              </span>
            </div>
          )}
          {desk.inventoryValue !== null && (
            <div className="kpi-card">
              <span className="kpi-label">ارزشِ انبار</span>
              <span className="kpi-value">{fa(desk.inventoryValue)}</span>
              <span className="kpi-delta neutral">ریال</span>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function KpiRow({ data }: { data: ManagerOverview }) {
  const { current, changePct } = data.totals;
  const decided = data.review.approved + data.review.rejected;
  const approvalRate = decided
    ? Math.round((data.review.approved / decided) * 100)
    : null;

  return (
    <div className="kpi-row">
      <div className="kpi-card brand">
        <span className="kpi-label">گزارش‌های این بازه</span>
        <span className="kpi-value">{fa(current)}</span>
        {changePct === null ? (
          <span className="kpi-delta neutral">بازه‌ی قبل داده‌ای نداشت</span>
        ) : (
          <span
            className={`kpi-delta ${changePct > 0 ? "up" : changePct < 0 ? "down" : "neutral"}`}
          >
            {changePct > 0 ? "▲" : changePct < 0 ? "▼" : "■"}{" "}
            {fa(Math.abs(changePct))}٪ نسبت به بازه‌ی قبل
          </span>
        )}
      </div>

      <Link
        to="/approvals"
        className={`kpi-card ${data.review.pending ? "warn" : ""}`}
      >
        <span className="kpi-label">درخواست‌های معلق</span>
        <span className="kpi-value">{fa(data.review.pending)}</span>
        <span className="kpi-delta neutral">
          {data.review.pending ? "منتظرِ تصمیمِ شما" : "کارتابل خالی است"}
        </span>
      </Link>

      <div className="kpi-card">
        <span className="kpi-label">نرخِ تأیید</span>
        <span className="kpi-value">
          {approvalRate === null ? "—" : `${fa(approvalRate)}٪`}
        </span>
        <span className="kpi-delta neutral">
          {fa(data.review.approved)} تأیید · {fa(data.review.rejected)} رد
        </span>
      </div>

      <div className="kpi-card">
        <span className="kpi-label">فرم‌های فعال</span>
        <span className="kpi-value">{fa(data.activeForms)}</span>
        <span className="kpi-delta neutral">در حالِ جمع‌آوریِ گزارش</span>
      </div>
    </div>
  );
}

/** نمودارِ سطحیِ روند با شبکه‌ی افقی و برچسبِ شمسی. */
function TrendChart({ series }: { series: ManagerOverview["series"] }) {
  const W = 760;
  const H = 220;
  const pad = { top: 16, right: 12, bottom: 28, left: 36 };
  const innerW = W - pad.left - pad.right;
  const innerH = H - pad.top - pad.bottom;

  const { points, ticks, max } = useMemo(() => {
    const max = Math.max(1, ...series.map((p) => p.count));
    // سقفِ گرد برای خطوطِ راهنمای خوانا.
    const step = Math.max(1, Math.ceil(max / 4));
    const top = step * 4;
    const n = Math.max(1, series.length - 1);
    // RTL: جدیدترین روز سمتِ چپ نیست؛ محورِ زمان از راست به چپ می‌رود.
    const points = series.map((p, i) => ({
      x: pad.left + innerW - (i / n) * innerW,
      y: pad.top + innerH - (p.count / top) * innerH,
      ...p,
    }));
    const ticks = [0, 1, 2, 3, 4].map((k) => ({
      value: step * k,
      y: pad.top + innerH - ((step * k) / top) * innerH,
    }));
    return { points, ticks, max };
  }, [series, innerW, innerH, pad.left, pad.top]);

  if (max <= 1 && series.every((p) => p.count === 0)) {
    return <p className="empty">در این بازه هنوز گزارشی ثبت نشده است.</p>;
  }

  const line = points.map((p) => `${p.x},${p.y}`).join(" ");
  const area = `${pad.left + innerW},${pad.top + innerH} ${line} ${pad.left},${pad.top + innerH}`;
  // حداکثر ~۷ برچسب روی محورِ افقی تا روی هم نیفتند.
  const every = Math.max(1, Math.ceil(series.length / 7));

  return (
    <svg
      className="trend-chart"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label="روندِ روزانه‌ی گزارش‌ها"
    >
      <defs>
        <linearGradient id="ov-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--blue-500)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--blue-500)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {ticks.map((t) => (
        <g key={t.value}>
          <line
            x1={pad.left}
            x2={pad.left + innerW}
            y1={t.y}
            y2={t.y}
            className="grid-line"
          />
          <text x={pad.left - 6} y={t.y + 4} className="axis-label" textAnchor="end">
            {fa(t.value)}
          </text>
        </g>
      ))}

      <polygon points={area} fill="url(#ov-area)" />
      <polyline points={line} className="trend-line" />

      {points.map((p, i) => (
        <g key={p.date}>
          <circle cx={p.x} cy={p.y} r={p.count ? 3.5 : 2} className="trend-dot">
            <title>
              {jalaliShort(p.date)}: {fa(p.count)} گزارش
            </title>
          </circle>
          {(i % every === 0 || i === points.length - 1) && (
            <text x={p.x} y={H - 8} className="axis-label" textAnchor="middle">
              {jalaliShort(p.date)}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

function UnitBars({ units }: { units: ManagerOverview["byUnit"] }) {
  if (units.length === 0) {
    return (
      <p className="empty">
        واحدی با فرم نیست. از «واحدهای هتل» راه‌اندازی کنید.
      </p>
    );
  }
  const max = Math.max(1, ...units.map((u) => u.count));
  return (
    <ul className="unit-bars">
      {units.map((u) => (
        <li key={u.departmentId ?? "public"}>
          <div className="unit-bar-head">
            <span>{u.name}</span>
            <strong>{fa(u.count)}</strong>
          </div>
          <div className="unit-bar-track">
            <div
              className={`unit-bar-fill ${u.count === 0 ? "zero" : ""}`}
              style={{ width: `${Math.max(2, (u.count / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** دونات: تأیید / رد / معلق. */
function ReviewDonut({ review }: { review: ManagerOverview["review"] }) {
  const parts = [
    { key: "approved", label: "تأیید", value: review.approved, color: "var(--success-500)" },
    { key: "rejected", label: "رد", value: review.rejected, color: "var(--danger-500)" },
    { key: "pending", label: "معلق", value: review.pending, color: "var(--warning-500)" },
  ];
  const total = parts.reduce((s, p) => s + p.value, 0);
  const R = 52;
  const C = 2 * Math.PI * R;

  if (total === 0) {
    return (
      <p className="empty">
        هنوز درخواستی در گردش‌کارِ تأیید نیست. برای فرم‌های درخواست (مثلِ
        مرخصی) «نیازمندِ تأیید» را روشن کنید.
      </p>
    );
  }

  let offset = 0;
  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 140 140" className="donut" role="img" aria-label="وضعیتِ تأیید">
        <circle cx="70" cy="70" r={R} className="donut-track" />
        {parts.map((p) => {
          const len = (p.value / total) * C;
          const el = (
            <circle
              key={p.key}
              cx="70"
              cy="70"
              r={R}
              fill="none"
              stroke={p.color}
              strokeWidth="18"
              strokeDasharray={`${len} ${C - len}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 70 70)"
            >
              <title>
                {p.label}: {fa(p.value)}
              </title>
            </circle>
          );
          offset += len;
          return el;
        })}
        <text x="70" y="68" textAnchor="middle" className="donut-total">
          {fa(total)}
        </text>
        <text x="70" y="86" textAnchor="middle" className="donut-caption">
          درخواست
        </text>
      </svg>
      <ul className="donut-legend">
        {parts.map((p) => (
          <li key={p.key}>
            <span className="legend-dot" style={{ background: p.color }} />
            {p.label}
            <strong>{fa(p.value)}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TopForms({ forms }: { forms: ManagerOverview["topForms"] }) {
  if (forms.length === 0) {
    return <p className="empty">در این بازه گزارشی ثبت نشده است.</p>;
  }
  const max = Math.max(1, ...forms.map((f) => f.count));
  return (
    <ol className="top-forms">
      {forms.map((f) => (
        <li key={f.formId}>
          <Link to={`/forms/${f.formId}`}>{f.title}</Link>
          <div className="top-form-bar">
            <div style={{ width: `${(f.count / max) * 100}%` }} />
            <span>{fa(f.count)}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}
