interface Props {
  min: number;
  max: number;
  value: number | null;
  startLabel: string;
  endLabel: string;
  /** چهرک واکنشی بالای نوار؛ در تنظیمات سوال قابل خاموش کردن است. */
  showEmoji?: boolean;
  onChange: (value: number) => void;
}

/**
 * چهرک و برچسب هر سطح رضایت، از ناراضی تا خیلی راضی.
 *
 * نسبت (۰ تا ۱) مبناست نه خودِ عدد، تا برای مقیاس ۰ تا ۱۰ و ۱ تا ۵ یکسان
 * کار کند.
 */
const MOODS: Array<{ upTo: number; emoji: string; label: string }> = [
  { upTo: 0.2, emoji: '😠', label: 'خیلی ناراضی' },
  { upTo: 0.4, emoji: '🙁', label: 'ناراضی' },
  { upTo: 0.6, emoji: '😐', label: 'متوسط' },
  { upTo: 0.8, emoji: '🙂', label: 'راضی' },
  { upTo: 1.01, emoji: '😍', label: 'خیلی راضی' },
];

function moodFor(ratio: number) {
  return MOODS.find((m) => ratio <= m.upTo) ?? MOODS[MOODS.length - 1];
}

/**
 * مقیاس امتیاز به شکل متر خطی.
 *
 * به‌جای ده دکمه‌ی جدا، یک نوار پیوسته که تا امتیاز انتخابی پر می‌شود.
 * دو دلیل: روی موبایل ده دکمه‌ی کوچک کنار هم بد لمس می‌شود، و نوارِ پرشونده
 * فوری می‌گوید «۸ از ۱۰» — چیزی که ده دکمه‌ی هم‌اندازه نمی‌گوید.
 *
 * رنگ از قرمز به سبز می‌رود تا معنای عدد هم دیده شود، نه فقط خودش.
 */
export function ScaleMeter({
  min,
  max,
  value,
  startLabel,
  endLabel,
  showEmoji = true,
  onChange,
}: Props) {
  const steps = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const span = max - min || 1;
  const ratio = value === null ? 0 : (value - min) / span;
  const mood = moodFor(ratio);

  return (
    <div
      className="scale-meter"
      role="radiogroup"
      aria-label={`${startLabel} تا ${endLabel}`}
    >
      {showEmoji && (
        <div className="meter-mood" aria-live="polite">
          <span
            // کلید با مقدار عوض می‌شود تا انیمیشن ورود هر بار دوباره اجرا
            // شود؛ بدون آن چهرک بی‌صدا عوض می‌شود و تغییرش دیده نمی‌شود.
            key={value === null ? 'empty' : mood.emoji}
            className="mood-emoji"
            role="img"
            aria-label={value === null ? 'بدون امتیاز' : mood.label}
          >
            {value === null ? '🙂' : mood.emoji}
          </span>
          <span className="mood-label">
            {value === null ? 'امتیاز خود را انتخاب کنید' : mood.label}
          </span>
        </div>
      )}

      <div className="meter-head">
        <span className="meter-endpoint">{startLabel}</span>
        <span className="meter-value" aria-live="polite">
          {value === null ? '—' : `${value} از ${max}`}
        </span>
        <span className="meter-endpoint">{endLabel}</span>
      </div>

      <div className="meter-track">
        <div
          className="meter-fill"
          style={{
            width: value === null ? 0 : `${ratio * 100}%`,
            background: fillColor(ratio),
          }}
        />

        {steps.map((step) => {
          const active = value !== null && step <= value;
          return (
            <button
              key={step}
              type="button"
              role="radio"
              aria-checked={value === step}
              aria-label={String(step)}
              className={
                value === step
                  ? 'meter-step current'
                  : active
                    ? 'meter-step filled'
                    : 'meter-step'
              }
              onClick={() => onChange(step)}
            >
              <span>{step}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * رنگ نوار بر اساس نسبت امتیاز: قرمز → کهربایی → سبز.
 *
 * درون‌یابی در فضای HSL انجام می‌شود چون درون‌یابی مستقیم RGB بین قرمز و
 * سبز از خاکستری گل‌آلود رد می‌شود.
 */
function fillColor(ratio: number): string {
  const hue = Math.round(ratio * 120); // ۰ قرمز، ۱۲۰ سبز
  return `hsl(${hue}, 62%, 45%)`;
}
