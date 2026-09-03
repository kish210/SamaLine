import type { Question } from './types';

interface Props {
  question: Question;
  value: unknown;
  lang: string;
  onChange: (value: unknown) => void;
}

const asText = (value: unknown) => (value == null ? '' : String(value));

/** رندر یک سوال بر اساس نوع آن. عنوان از سرور Piping‌شده می‌آید. */
export function QuestionField({ question, value, lang, onChange }: Props) {
  const q = question;
  const translated = q.meta?.translations?.[lang];

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

  if (q.type === 'multiple_choice' && q.meta?.multiple) {
    return (
      <div>
        {(q.options ?? []).map((option) => (
          <label key={option} className="row">
            <input
              type="checkbox"
              checked={Array.isArray(value) && value.includes(option)}
              onChange={(e) => toggleChoice(option, e.target.checked)}
            />
            {option}
          </label>
        ))}
      </div>
    );
  }

  if (q.type === 'multiple_choice' || q.type === 'dropdown') {
    return (
      <select
        required={q.required}
        value={asText(value)}
        onChange={(e) => onChange(e.target.value)}
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
    return (
      <select
        required={q.required}
        value={asText(value)}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">انتخاب کنید</option>
        <option value="yes">بله</option>
        <option value="no">خیر</option>
      </select>
    );
  }

  if (q.type === 'rating' || q.type === 'slider' || q.type === 'nps') {
    const min = q.type === 'nps' ? 0 : (q.meta?.min ?? 1);
    const max = q.type === 'nps' ? 10 : (q.meta?.max ?? 5);
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
      <textarea
        required={q.required}
        value={Array.isArray(value) ? value.join('، ') : asText(value)}
        placeholder="گزینه‌ها را به ترتیب اولویت و با ویرگول وارد کنید"
        onChange={(e) =>
          onChange(
            e.target.value
              .split(/[،,]/)
              .map((item) => item.trim())
              .filter(Boolean),
          )
        }
      />
    );
  }

  if (q.type === 'date') {
    return (
      <input
        type="date"
        required={q.required}
        value={asText(value)}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (
    ['file_upload', 'camera', 'audio_record', 'signature', 'location'].includes(
      q.type,
    )
  ) {
    return (
      <textarea
        required={q.required}
        value={asText(value)}
        placeholder="نشانی یا مقدار JSON این فیلد را وارد کنید"
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  const inputType =
    q.type === 'number'
      ? 'number'
      : q.type === 'email'
        ? 'email'
        : q.type === 'url'
          ? 'url'
          : q.type === 'mobile' || q.type === 'phone'
            ? 'tel'
            : 'text';

  return (
    <input
      type={inputType}
      required={q.required}
      min={q.meta?.min}
      max={q.meta?.max}
      step={q.meta?.step}
      inputMode={q.type === 'mobile' || q.type === 'phone' ? 'numeric' : undefined}
      pattern={q.type === 'mobile' ? '09[0-9]{9}' : undefined}
      value={asText(value)}
      onChange={(e) =>
        onChange(q.type === 'number' ? Number(e.target.value) : e.target.value)
      }
    />
  );
}
