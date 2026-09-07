import { useEffect, useState } from 'react';
import type { FormPage, ScoreIndex } from '../../types';

interface Props {
  pages: FormPage[];
  indexes: ScoreIndex[];
  onChange: (next: ScoreIndex[]) => void;
}

/** روش‌های محاسبه‌ی شاخص، با توضیح — نام تنها گویا نیست. */
const METHODS: Array<{
  value: ScoreIndex['method'];
  label: string;
  hint: string;
}> = [
  {
    value: 'avg',
    label: 'میانگین',
    hint: 'میانگین امتیاز سوال‌های عضو؛ رایج‌ترین حالت برای رضایت‌سنجی.',
  },
  {
    value: 'sum',
    label: 'جمع',
    hint: 'جمع ساده‌ی امتیازها؛ برای آزمون و امتیاز کل.',
  },
  {
    value: 'weighted',
    label: 'میانگین وزنی',
    hint: 'وزن هر سوال در محاسبه اثر می‌گذارد؛ وزن را در همان سوال بگذارید.',
  },
  {
    value: 'percent',
    label: 'درصد',
    hint: 'جمع امتیاز تقسیم بر سقف، ضربدر صد.',
  },
];

/** نوع‌هایی که پاسخشان عددی است و می‌شود امتیاز گرفت. */
const SCORABLE = new Set([
  'rating',
  'nps',
  'slider',
  'number',
  'boolean',
  'multiple_choice',
  'dropdown',
]);

/**
 * تعریف شاخص‌های امتیازدهی یک فرم.
 *
 * عضویت سوال در شاخص عمداً از سمت شاخص تعریف می‌شود («این شاخص شامل کدام
 * سوال‌هاست»)، چون کاربر هم همین‌طور فکر می‌کند؛ انتخاب سوال‌به‌سوال برای
 * شاخصی با ده سوال یعنی ده بار رفت‌وبرگشت.
 */
export function IndicatorEditor({ pages, indexes, onChange }: Props) {
  const questions = pages.flatMap((page) =>
    (page.questions ?? []).map((q) => ({
      id: q.id,
      title: q.title || q.id,
      type: q.type as string,
      pageTitle: page.title,
    })),
  );
  const scorable = questions.filter((q) => SCORABLE.has(q.type));

  const add = () => {
    const n = indexes.length + 1;
    onChange([
      ...indexes,
      {
        id: `index_${Date.now().toString(36)}`,
        key: `شاخص ${n}`,
        method: 'avg',
        maxScore: 10,
        questionIds: [],
      },
    ]);
  };

  const patch = (id: string, next: Partial<ScoreIndex>) =>
    onChange(indexes.map((i) => (i.id === id ? { ...i, ...next } : i)));

  return (
    <section className="card">
      <div className="section-head">
        <h3>شاخص‌های امتیازدهی</h3>
        <button type="button" className="secondary" onClick={add}>
          افزودن شاخص
        </button>
      </div>

      <p className="hint">
        شاخص، چند سوال را به یک عدد تبدیل می‌کند — مثل «رضایت کلی» از میانگین
        همه‌ی سوال‌های امتیازی. این عدد در پایان فرم به پاسخ‌دهنده نشان داده
        می‌شود، در گزارش‌ها می‌آید، و می‌شود شرط منطق و آستانه‌ی هشدار تلگرام
        قرارش داد.
      </p>

      {scorable.length === 0 && (
        <p className="empty">
          هنوز سوال امتیازپذیری در فرم نیست. سوال امتیاز، NPS، اسلایدر یا
          عددی اضافه کنید.
        </p>
      )}

      {indexes.length === 0 ? (
        <p className="empty">شاخصی تعریف نشده است.</p>
      ) : (
        indexes.map((index) => (
          <IndicatorRow
            key={index.id}
            index={index}
            questions={scorable}
            onPatch={(next) => patch(index.id, next)}
            onRemove={() =>
              onChange(indexes.filter((i) => i.id !== index.id))
            }
            duplicateKey={
              indexes.filter((i) => i.key.trim() === index.key.trim()).length >
              1
            }
          />
        ))
      )}
    </section>
  );
}

interface RowProps {
  index: ScoreIndex;
  questions: Array<{ id: string; title: string; pageTitle?: string }>;
  onPatch: (next: Partial<ScoreIndex>) => void;
  onRemove: () => void;
  duplicateKey: boolean;
}

function IndicatorRow({
  index,
  questions,
  onPatch,
  onRemove,
  duplicateKey,
}: RowProps) {
  const [open, setOpen] = useState(false);
  const selected = new Set(index.questionIds ?? []);
  const method = METHODS.find((m) => m.value === index.method) ?? METHODS[0];

  const toggle = (questionId: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(questionId);
    else next.delete(questionId);
    onPatch({ questionIds: [...next] });
  };

  return (
    <div className="indicator-row">
      <div className="form-grid">
        <label>
          <span className="field-label">نام شاخص</span>
          <input
            value={index.key}
            onChange={(e) => onPatch({ key: e.target.value })}
            placeholder="رضایت کلی"
          />
          {duplicateKey && (
            <small className="error">
              نام تکراری است؛ دو شاخص هم‌نام در گزارش روی هم می‌افتند.
            </small>
          )}
        </label>

        <label>
          <span className="field-label">روش محاسبه</span>
          <select
            value={index.method}
            onChange={(e) =>
              onPatch({ method: e.target.value as ScoreIndex['method'] })
            }
          >
            {METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <small className="hint">{method.hint}</small>
        </label>

        <label>
          <span className="field-label">سقف امتیاز</span>
          <input
            type="number"
            min={1}
            value={index.maxScore ?? 10}
            onChange={(e) => onPatch({ maxScore: Number(e.target.value) })}
          />
          <small className="hint">
            مبنای «نرخ شاخص» در گزارش؛ برای سوال ۰ تا ۱۰ عدد ۱۰ درست است.
          </small>
        </label>
      </div>

      <div className="inline-form">
        <button
          type="button"
          className="secondary"
          onClick={() => setOpen((v) => !v)}
        >
          سوال‌های عضو ({selected.size})
        </button>
        <button type="button" className="danger" onClick={onRemove}>
          حذف شاخص
        </button>
      </div>

      {selected.size === 0 && (
        <p className="error">
          بدون سوال عضو، این شاخص همیشه صفر می‌ماند.
        </p>
      )}

      {open && (
        <div className="indicator-questions">
          {questions.map((question) => (
            <label key={question.id} className="checkbox">
              <input
                type="checkbox"
                checked={selected.has(question.id)}
                onChange={(e) => toggle(question.id, e.target.checked)}
              />
              {question.title}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/** ماندگار کردن شاخص‌ها در وضعیت محلی ویرایشگر. */
export function useIndicators(initial: ScoreIndex[] | undefined, key: string) {
  const [indexes, setIndexes] = useState<ScoreIndex[]>(initial ?? []);

  // مثل صفحه‌ها، ساختار سرور فقط با عوض شدن نسخه دوباره نشانده می‌شود تا
  // ویرایش‌های ذخیره‌نشده‌ی کاربر با هر بازخوانی از بین نروند.
  useEffect(() => {
    setIndexes(initial ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return [indexes, setIndexes] as const;
}
