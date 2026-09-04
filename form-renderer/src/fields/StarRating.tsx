interface Props {
  value: unknown;
  min: number;
  max: number;
  labels?: { start?: string; end?: string };
  onChange: (value: number) => void;
}

/** ستاره‌ی توپر یا توخالی. */
function Star({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 2.5l2.9 5.9 6.5.95-4.7 4.6 1.1 6.5L12 17.4l-5.8 3.05 1.1-6.5-4.7-4.6 6.5-.95z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * امتیازدهی با ستاره.
 *
 * حالت پیش‌فرض سوال «امتیازی» است؛ دکمه‌های عددی وقتی معنا دارند که بازه
 * بزرگ باشد (مثل NPS صفر تا ده) و ستاره در آن حالت خوانا نیست.
 */
export function StarRating({ value, min, max, labels, onChange }: Props) {
  const selected = value === undefined || value === null ? null : Number(value);
  const steps = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  return (
    <div className="star-rating">
      <div className="star-row" role="radiogroup">
        {steps.map((step) => (
          <button
            key={step}
            type="button"
            role="radio"
            aria-checked={selected === step}
            aria-label={`${step} از ${max}`}
            /* ستاره‌های تا این عدد پر می‌شوند، نه فقط خودش. */
            className={
              selected !== null && step <= selected ? 'star filled' : 'star'
            }
            onClick={() => onChange(step)}
          >
            <Star filled={selected !== null && step <= selected} />
          </button>
        ))}
      </div>

      <div className="scale-labels">
        <span>{labels?.start ?? 'کم'}</span>
        {selected !== null && (
          <strong className="star-value">
            {selected} از {max}
          </strong>
        )}
        <span>{labels?.end ?? 'زیاد'}</span>
      </div>
    </div>
  );
}
