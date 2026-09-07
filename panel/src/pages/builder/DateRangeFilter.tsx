import { useState } from 'react';
import { jalaliToIso, todayJalali } from '../../jalali';

export interface DateRange {
  from?: string;
  to?: string;
}

interface Props {
  value: DateRange;
  onChange: (next: DateRange) => void;
}

/** میان‌برهای رایج؛ عدد یعنی «این تعداد روز گذشته». */
const PRESETS: Array<{ label: string; days: number | null }> = [
  { label: 'همه', days: null },
  { label: '۷ روز', days: 7 },
  { label: '۳۰ روز', days: 30 },
  { label: '۹۰ روز', days: 90 },
];

/**
 * فیلتر بازه‌ی زمانی گزارش.
 *
 * ورودی به تاریخ شمسی گرفته می‌شود ولی به سرور میلادی فرستاده می‌شود؛
 * پاسخ‌ها با تاریخ میلادی ذخیره شده‌اند و تبدیل باید یک‌جا انجام شود، نه
 * در چند نقطه‌ی پراکنده.
 */
export function DateRangeFilter({ value, onChange }: Props) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const applyPreset = (days: number | null) => {
    setFrom('');
    setTo('');
    if (days === null) {
      onChange({});
      return;
    }
    const start = new Date();
    start.setDate(start.getDate() - days);
    onChange({ from: isoDay(start), to: isoDay(new Date()) });
  };

  const applyManual = () => {
    const fromIso = parseJalali(from);
    const toIso = parseJalali(to);
    // بازه‌ی وارونه سکوت نمی‌کند: بی‌سروصدا صفر پاسخ نشان دادن بدترین
    // حالت است، چون کاربر فکر می‌کند واقعا پاسخی نبوده.
    if (fromIso && toIso && fromIso > toIso) {
      onChange({ from: toIso, to: fromIso });
      const swapped = [to, from];
      setFrom(swapped[0]);
      setTo(swapped[1]);
      return;
    }
    onChange({ from: fromIso, to: toIso });
  };

  const active = (days: number | null) =>
    days === null
      ? !value.from && !value.to
      : false;

  return (
    <div className="date-range">
      <div className="range-presets">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            className={active(preset.days) ? 'active' : ''}
            onClick={() => applyPreset(preset.days)}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="range-manual">
        <input
          placeholder={`از ${sample()}`}
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          onBlur={applyManual}
        />
        <input
          placeholder={`تا ${sample()}`}
          value={to}
          onChange={(e) => setTo(e.target.value)}
          onBlur={applyManual}
        />
      </div>

      {(value.from || value.to) && (
        <span className="range-label">
          {value.from ?? '…'} تا {value.to ?? 'امروز'}
        </span>
      )}
    </div>
  );
}

function sample(): string {
  const today = todayJalali();
  return `${today.jy}/${String(today.jm).padStart(2, '0')}/${String(
    today.jd,
  ).padStart(2, '0')}`;
}

/** `۱۴۰۴/۰۶/۱۵` یا `1404-6-15` → تاریخ میلادی ISO. */
function parseJalali(text: string): string | undefined {
  const digits = text
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .match(/\d+/g);
  if (!digits || digits.length < 3) return undefined;

  const [jy, jm, jd] = digits.map(Number);
  if (jy < 1300 || jy > 1500) return undefined;
  if (jm < 1 || jm > 12 || jd < 1 || jd > 31) return undefined;
  return jalaliToIso(jy, jm, jd);
}

function isoDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}`;
}
