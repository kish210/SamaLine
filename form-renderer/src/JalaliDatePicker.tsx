import { useEffect, useMemo, useRef, useState } from 'react';
import type { JalaliDate } from './jalali';
import {
  JALALI_MONTHS,
  JALALI_WEEKDAYS,
  gregorianToJalali,
  isoToJalaliText,
  jalaliFirstWeekday,
  jalaliMonthLength,
  jalaliToIso,
  parseIso,
  todayJalali,
} from './jalali';

interface Props {
  value: string;
  required?: boolean;
  onChange: (iso: string) => void;
}

/**
 * انتخاب تاریخ با تقویم شمسی.
 *
 * مقدار همچنان میلادی (`YYYY-MM-DD`) به بیرون داده می‌شود تا ذخیره‌سازی و
 * گزارش‌ها تغییر نکنند؛ فقط نمایش شمسی است.
 */
export function JalaliDatePicker({ value, required, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => {
    const parsed = parseIso(value);
    return parsed
      ? gregorianToJalali(parsed.gy, parsed.gm, parsed.gd)
      : null;
  }, [value]);

  /*
   * ماهی که تقویم نشان می‌دهد.
   *
   * تا وقتی کاربر با فلش‌ها ماه را عوض نکرده، ماهِ نمایش از خودِ مقدار
   * انتخابی مشتق می‌شود؛ این‌طور نیازی به همگام‌سازی با useEffect نیست و
   * رندر اضافه پیش نمی‌آید.
   */
  const [browsing, setBrowsing] = useState<JalaliDate | null>(null);
  const view = browsing ?? selected ?? todayJalali();

  const closePopup = () => {
    setOpen(false);
    setBrowsing(null);
  };

  // کلیک بیرون از تقویم آن را می‌بندد.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) closePopup();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const monthLength = jalaliMonthLength(view.jy, view.jm);
  const offset = jalaliFirstWeekday(view.jy, view.jm);
  const today = todayJalali();

  const shiftMonth = (delta: number) => {
    const total = view.jy * 12 + (view.jm - 1) + delta;
    setBrowsing({
      jy: Math.floor(total / 12),
      jm: (total % 12) + 1,
      jd: 1,
    });
  };

  const pick = (day: number) => {
    onChange(jalaliToIso(view.jy, view.jm, day));
    closePopup();
  };

  return (
    <div className="jalali-wrap" ref={wrapRef}>
      <button
        type="button"
        className="jalali-input"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className={value ? '' : 'placeholder'}>
          {value ? isoToJalaliText(value) : 'انتخاب تاریخ'}
        </span>
      </button>

      {/* مقدار واقعی برای اعتبارسنجی مرورگر و ارسال فرم. */}
      <input
        type="hidden"
        value={value}
        required={required}
        readOnly
        aria-hidden="true"
      />

      {open && (
        <div className="jalali-popup" role="dialog">
          <div className="jalali-head">
            <button
              type="button"
              className="jalali-nav"
              aria-label="ماه بعد"
              onClick={() => shiftMonth(1)}
            >
              ‹
            </button>
            <span>
              {JALALI_MONTHS[view.jm - 1]} {view.jy}
            </span>
            <button
              type="button"
              className="jalali-nav"
              aria-label="ماه قبل"
              onClick={() => shiftMonth(-1)}
            >
              ›
            </button>
          </div>

          <div className="jalali-grid">
            {JALALI_WEEKDAYS.map((day) => (
              <span key={day} className="jalali-weekday">
                {day}
              </span>
            ))}
            {Array.from({ length: offset }, (_, i) => (
              <span key={`pad-${i}`} />
            ))}
            {Array.from({ length: monthLength }, (_, i) => i + 1).map((day) => {
              const isSelected =
                selected?.jy === view.jy &&
                selected?.jm === view.jm &&
                selected?.jd === day;
              const isToday =
                today.jy === view.jy &&
                today.jm === view.jm &&
                today.jd === day;
              return (
                <button
                  key={day}
                  type="button"
                  className={[
                    'jalali-day',
                    isSelected ? 'selected' : '',
                    isToday ? 'today' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => pick(day)}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <div className="jalali-foot">
            <button
              type="button"
              className="jalali-today"
              onClick={() => {
                // امروز ممکن است در ماهی غیر از ماه نمایش‌داده‌شده باشد.
                onChange(jalaliToIso(today.jy, today.jm, today.jd));
                closePopup();
              }}
            >
              امروز
            </button>
            {value && (
              <button
                type="button"
                className="jalali-clear"
                onClick={() => {
                  onChange('');
                  closePopup();
                }}
              >
                پاک کردن
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
