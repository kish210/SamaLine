import { EmojiChoice, ImageChoice, Ranking } from './fields/ChoiceFields';
import {
  AudioField,
  FileField,
  LocationField,
  SignatureField,
} from './fields/MediaFields';
import { StarRating } from './fields/StarRating';
import { JalaliDatePicker } from './JalaliDatePicker';
import { QuestionIcon } from './QuestionIcon';
import { hasIcon } from './question-icons';
import type { Question } from './types';

interface Props {
  question: Question;
  value: unknown;
  lang: string;
  onChange: (value: unknown) => void;
  /**
   * پس از انتخاب یک گزینه‌ی قطعی (تک‌انتخابی، بله/خیر، امتیاز) صدا زده
   * می‌شود تا فرم خودکار به سوال بعد برود. اگر داده نشود، رفتار عوض نمی‌شود.
   */
  onCommit?: () => void;
}

const asText = (value: unknown) => (value == null ? '' : String(value));

/** ارقام فارسی و عربی را به لاتین تبدیل می‌کند. */
function toLatinDigits(input: string): string {
  return input.replace(/[۰-۹٠-٩]/g, (digit) =>
    String(
      digit.charCodeAt(0) >= 0x06f0
        ? digit.charCodeAt(0) - 0x06f0
        : digit.charCodeAt(0) - 0x0660,
    ),
  );
}

/**
 * ماسک شماره‌ی موبایل ایران: فقط رقم، حداکثر ۱۱ رقم، با گروه‌بندی
 * `0912 345 6789` برای خوانایی. مقدار ذخیره‌شده بدون فاصله است.
 */
function digitsOnly(input: string, max: number): string {
  return toLatinDigits(input).replace(/\D/g, '').slice(0, max);
}

function formatMobile(digits: string): string {
  const parts = [digits.slice(0, 4), digits.slice(4, 7), digits.slice(7, 11)];
  return parts.filter(Boolean).join(' ');
}

/** رندر یک سوال بر اساس نوع آن. عنوان از سرور Piping‌شده می‌آید. */
export function QuestionField({
  question,
  value,
  lang,
  onChange,
  onCommit,
}: Props) {
  const q = question;
  const translated = q.meta?.translations?.[lang];

  // انتخاب قطعی: مقدار را می‌نویسد و در صورت نیاز به سوال بعد می‌رود.
  const commit = (next: unknown) => {
    onChange(next);
    onCommit?.();
  };

  const toggleChoice = (option: string, checked: boolean) => {
    const current = Array.isArray(value) ? (value as string[]) : [];
    onChange(
      checked
        ? Array.from(new Set([...current, option]))
        : current.filter((item) => item !== option),
    );
  };

  const setMatrixCell = (row: string, cell: string) => {
    const matrix = (value as Record<string, string> | undefined) ?? {};
    onChange({ ...matrix, [row]: cell });
  };

  if (q.type === 'static_text') {
    return <p className="static-text">{translated ?? q.title}</p>;
  }

  if (q.type === 'long_text') {
    return (
      <textarea
        required={q.required}
        value={asText(value)}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (q.type === 'emoji') {
    return (
      <EmojiChoice
        options={q.options ?? []}
        value={value}
        onChange={(next) => commit(next)}
      />
    );
  }

  if (q.type === 'image_choice') {
    return (
      <ImageChoice
        options={q.options ?? []}
        value={value}
        onChange={(next) => commit(next)}
      />
    );
  }

  // چندانتخابی: کارت با تیک، نه فهرست چک‌باکس ساده.
  if (q.type === 'multiple_choice' && q.meta?.multiple) {
    const current = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div className="option-cards">
        {(q.options ?? []).map((option) => {
          const checked = current.includes(option);
          return (
            <label
              key={option}
              className={checked ? 'option-card selected' : 'option-card'}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => toggleChoice(option, e.target.checked)}
              />
              <span className="option-mark" aria-hidden="true" />
              <span className="option-label">{option}</span>
            </label>
          );
        })}
      </div>
    );
  }

  // تک‌انتخابی: کارت‌های قابل لمس به‌جای لیست کشویی.
  // «dropdown» عمداً همچنان select می‌ماند چون خودِ نوع سوال همین را می‌خواهد.
  if (q.type === 'multiple_choice') {
    const current = asText(value);
    return (
      <div className="option-cards">
        {(q.options ?? []).map((option) => (
          <label
            key={option}
            className={
              current === option ? 'option-card radio selected' : 'option-card radio'
            }
          >
            <input
              type="radio"
              name={q.id}
              checked={current === option}
              onChange={() => commit(option)}
            />
            <span className="option-mark" aria-hidden="true" />
            <span className="option-label">{option}</span>
          </label>
        ))}
      </div>
    );
  }

  if (q.type === 'dropdown') {
    return (
      <select
        required={q.required}
        value={asText(value)}
        onChange={(e) => commit(e.target.value)}
      >
        <option value="">انتخاب کنید</option>
        {(q.options ?? []).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  if (q.type === 'boolean') {
    const current = asText(value);
    return (
      <div className="option-cards two">
        {[
          { value: 'yes', label: 'بله' },
          { value: 'no', label: 'خیر' },
        ].map((choice) => (
          <label
            key={choice.value}
            className={
              current === choice.value
                ? 'option-card radio selected'
                : 'option-card radio'
            }
          >
            <input
              type="radio"
              name={q.id}
              checked={current === choice.value}
              onChange={() => commit(choice.value)}
            />
            <span className="option-mark" aria-hidden="true" />
            <span className="option-label">{choice.label}</span>
          </label>
        ))}
      </div>
    );
  }

  /*
   * امتیازی با ستاره نشان داده می‌شود، مگر بازه بزرگ باشد.
   *
   * بالای هفت ستاره، شمردن ستاره‌ها از خودِ عدد سخت‌تر است؛ آنجا به
   * دکمه‌های عددی برمی‌گردیم. با meta.style هم می‌شود صریح انتخاب کرد.
   */
  if (q.type === 'rating') {
    const min = q.meta?.min ?? 1;
    const max = q.meta?.max ?? 5;
    const useStars =
      q.meta?.style === 'star' || (q.meta?.style !== 'number' && max - min <= 6);

    if (useStars) {
      return (
        <StarRating
          value={value}
          min={min}
          max={max}
          labels={q.meta?.labels}
          onChange={(next) => commit(next)}
        />
      );
    }
  }

  // NPS و امتیازیِ بازه‌بزرگ با دکمه‌های عددی: یک ضربه و مقدار پیداست.
  if (q.type === 'nps' || q.type === 'rating') {
    const min = q.type === 'nps' ? 0 : (q.meta?.min ?? 1);
    const max = q.type === 'nps' ? 10 : (q.meta?.max ?? 5);
    const steps = Array.from({ length: max - min + 1 }, (_, i) => min + i);
    const selected = value === undefined || value === null ? null : Number(value);

    return (
      <div className="scale">
        <div className="scale-buttons">
          {steps.map((step) => (
            <button
              key={step}
              type="button"
              className={selected === step ? 'scale-step active' : 'scale-step'}
              onClick={() => commit(step)}
            >
              {step}
            </button>
          ))}
        </div>
        <div className="scale-labels">
          <span>{q.meta?.labels?.start ?? 'کم'}</span>
          <span>{q.meta?.labels?.end ?? 'زیاد'}</span>
        </div>
      </div>
    );
  }

  if (q.type === 'slider') {
    const min = q.meta?.min ?? 1;
    const max = q.meta?.max ?? 5;
    const current = Number(value ?? min);
    return (
      <div>
        <input
          type="range"
          min={min}
          max={max}
          step={q.meta?.step ?? 1}
          value={current}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <small>
          {q.meta?.labels?.start ?? 'کم'} — {q.meta?.labels?.end ?? 'زیاد'}:{' '}
          {current}
        </small>
      </div>
    );
  }

  if (q.type === 'matrix') {
    const matrix = (value as Record<string, string> | undefined) ?? {};
    const columns = q.meta?.columns ?? q.options ?? ['۱', '۲', '۳', '۴', '۵'];
    return (
      <div>
        {(q.meta?.rows ?? ['ردیف ۱']).map((row) => (
          <div key={row} className="row">
            <span style={{ minWidth: 120 }}>{row}</span>
            <select
              value={matrix[row] ?? ''}
              onChange={(e) => setMatrixCell(row, e.target.value)}
            >
              <option value="">انتخاب</option>
              {columns.map((column) => (
                <option key={column} value={column}>
                  {column}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    );
  }

  if (q.type === 'ranking') {
    return (
      <Ranking options={q.options ?? []} value={value} onChange={onChange} />
    );
  }

  if (q.type === 'date') {
    return (
      <JalaliDatePicker
        value={asText(value)}
        required={q.required}
        onChange={(iso) => onChange(iso)}
      />
    );
  }

  if (q.type === 'file_upload') {
    return (
      <FileField
        value={value}
        onChange={onChange}
        accept="image/*,application/pdf"
        label="انتخاب فایل"
      />
    );
  }

  if (q.type === 'camera') {
    return (
      <FileField
        value={value}
        onChange={onChange}
        accept="image/*"
        capture
        label="گرفتن عکس"
      />
    );
  }

  if (q.type === 'signature') {
    return <SignatureField value={value} onChange={onChange} />;
  }

  if (q.type === 'location') {
    return <LocationField value={value} onChange={onChange} />;
  }

  if (q.type === 'audio_record') {
    return <AudioField value={value} onChange={onChange} />;
  }

  // شماره‌ی موبایل: فقط رقم پذیرفته می‌شود و با فاصله گروه‌بندی می‌شود،
  // ولی مقدار ذخیره‌شده همان ۱۱ رقم پیوسته است.
  if (q.type === 'mobile' || q.type === 'phone') {
    const digits = digitsOnly(asText(value), q.type === 'mobile' ? 11 : 15);
    return (
      <div className="field-with-icon">
        <QuestionIcon type={q.type} />
        <input
          type="tel"
          required={q.required}
          inputMode="numeric"
          autoComplete="tel"
          dir="ltr"
          placeholder={q.type === 'mobile' ? '0912 345 6789' : ''}
          value={q.type === 'mobile' ? formatMobile(digits) : digits}
          onChange={(e) =>
            onChange(digitsOnly(e.target.value, q.type === 'mobile' ? 11 : 15))
          }
        />
      </div>
    );
  }

  const inputType =
    q.type === 'number'
      ? 'number'
      : q.type === 'email'
        ? 'email'
        : q.type === 'url'
          ? 'url'
          : 'text';

  const input = (
    <input
      type={inputType}
      required={q.required}
      min={q.meta?.min}
      max={q.meta?.max}
      step={q.meta?.step}
      dir={q.type === 'email' || q.type === 'url' ? 'ltr' : undefined}
      value={asText(value)}
      onChange={(e) =>
        onChange(q.type === 'number' ? Number(e.target.value) : e.target.value)
      }
    />
  );

  return hasIcon(q.type) ? (
    <div className="field-with-icon">
      <QuestionIcon type={q.type} />
      {input}
    </div>
  ) : (
    input
  );
}
