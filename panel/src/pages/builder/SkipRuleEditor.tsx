import { useState } from 'react';
import type { FormPage, SkipRule } from '../../types';

const OPERATORS: Array<{ value: string; label: string; needsValue: boolean }> = [
  { value: 'equals', label: 'برابر باشد با', needsValue: true },
  { value: 'not_equals', label: 'برابر نباشد با', needsValue: true },
  { value: 'contains', label: 'شامل باشد', needsValue: true },
  { value: 'starts_with', label: 'شروع شود با', needsValue: true },
  { value: 'gt', label: 'بیشتر باشد از', needsValue: true },
  { value: 'lt', label: 'کمتر باشد از', needsValue: true },
  { value: 'is_empty', label: 'خالی باشد', needsValue: false },
  { value: 'is_not_empty', label: 'خالی نباشد', needsValue: false },
];

const END = '__end__';

interface Props {
  pages: FormPage[];
  /** قانونی که ویرایش می‌شود؛ نبودنش یعنی ساخت قانون تازه. */
  rule?: SkipRule;
  onSave: (rule: SkipRule) => void;
  onCancel: () => void;
}

/**
 * ساخت و ویرایش یک قانون پرش.
 *
 * عمداً فقط یک شرط تکی گرفته می‌شود، نه گروه تو در تو: شرط‌های چندلایه در
 * یک فرم نظرسنجی به‌ندرت لازم‌اند و رابطشان پیچیده می‌شود. ساختار ذخیره‌شده
 * همان گروه است، پس قانون‌های پیچیده‌تری که از جای دیگر آمده‌اند نمی‌شکنند —
 * فقط اینجا قابل ویرایش نیستند و همان‌طور که هستند می‌مانند.
 */
export function SkipRuleEditor({ pages, rule, onSave, onCancel }: Props) {
  const questions = pages.flatMap((page) =>
    (page.questions ?? []).map((q) => ({
      id: q.id,
      title: q.title || q.id,
      pageId: page.id,
    })),
  );

  const existing = rule?.when?.conditions?.[0];

  const [fromPageId, setFromPageId] = useState(
    rule?.fromPageId ??
      (rule?.fromQuestionId
        ? (questions.find((q) => q.id === rule.fromQuestionId)?.pageId ?? '')
        : (pages[0]?.id ?? '')),
  );
  const [target, setTarget] = useState(
    rule?.toEnd ? END : (rule?.toPageId ?? ''),
  );
  const [source, setSource] = useState(
    (existing?.source as string) ?? (questions[0]?.id ?? ''),
  );
  const [operator, setOperator] = useState(
    (existing?.operator as string) ?? 'equals',
  );
  const [value, setValue] = useState(
    existing?.value === undefined ? '' : String(existing.value),
  );
  const [always, setAlways] = useState(!rule?.when);

  const needsValue =
    OPERATORS.find((o) => o.value === operator)?.needsValue ?? true;

  /**
   * پرش به همان صفحه یعنی حلقه‌ی بی‌پایان؛ سرور هم ردش می‌کند، ولی گفتنش
   * اینجا خیلی زودتر از پیغام خطای ذخیره جلوی اشتباه را می‌گیرد.
   */
  const selfLoop = target !== END && target === fromPageId;
  const complexCondition = (rule?.when?.conditions?.length ?? 0) > 1;

  const submit = () => {
    const next: SkipRule = {
      fromPageId,
      ...(target === END ? { toEnd: true } : { toPageId: target }),
    };
    if (!always) {
      next.when = {
        combinator: 'and',
        conditions: [
          {
            source,
            operator,
            ...(needsValue ? { value: coerce(value) } : {}),
          },
        ],
      };
    }
    onSave(next);
  };

  return (
    <div className="card skip-editor">
      <h4>{rule ? 'ویرایش قانون پرش' : 'قانون پرش تازه'}</h4>

      {complexCondition && (
        <p className="error">
          این قانون چند شرط دارد و اینجا فقط شرط اول ویرایش می‌شود؛ ذخیره،
          بقیه‌ی شرط‌ها را حذف می‌کند.
        </p>
      )}

      <div className="form-grid">
        <label>
          <span className="field-label">پس از صفحه‌ی</span>
          <select
            value={fromPageId}
            onChange={(e) => setFromPageId(e.target.value)}
          >
            {pages.map((page) => (
              <option key={page.id} value={page.id}>
                {page.title || page.id}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="field-label">برو به</span>
          <select value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="">انتخاب کنید…</option>
            {pages.map((page) => (
              <option key={page.id} value={page.id}>
                {page.title || page.id}
              </option>
            ))}
            <option value={END}>پایان فرم</option>
          </select>
        </label>
      </div>

      <label className="checkbox">
        <input
          type="checkbox"
          checked={always}
          onChange={(e) => setAlways(e.target.checked)}
        />
        همیشه (بدون شرط)
      </label>

      {!always && (
        <div className="form-grid three">
          <label>
            <span className="field-label">اگر</span>
            <select value={source} onChange={(e) => setSource(e.target.value)}>
              {questions.map((question) => (
                <option key={question.id} value={question.id}>
                  {question.title}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="field-label">شرط</span>
            <select
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
            >
              {OPERATORS.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>
          </label>

          {needsValue && (
            <label>
              <span className="field-label">مقدار</span>
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="مثلا: بله یا 5"
              />
            </label>
          )}
        </div>
      )}

      {selfLoop && (
        <p className="error">
          مقصد نمی‌تواند همان صفحه‌ی مبدأ باشد؛ فرم در حلقه می‌افتد.
        </p>
      )}

      <div className="inline-form">
        <button
          type="button"
          onClick={submit}
          disabled={!target || selfLoop || (!always && !source)}
        >
          {rule ? 'ذخیره‌ی تغییر' : 'افزودن قانون'}
        </button>
        <button type="button" className="secondary" onClick={onCancel}>
          انصراف
        </button>
      </div>
    </div>
  );
}

/**
 * مقدار متنی را در صورت عددی بودن به عدد تبدیل می‌کند.
 *
 * اپراتورهای `gt`/`lt` روی رشته مقایسه‌ی الفبایی می‌کنند و «10» کمتر از «9»
 * درمی‌آید؛ نگه داشتن نوع عددی جلوی این را می‌گیرد.
 */
function coerce(text: string): string | number {
  const trimmed = text.trim();
  if (trimmed === '') return trimmed;
  const asNumber = Number(trimmed);
  return Number.isFinite(asNumber) && /^-?\d+(\.\d+)?$/.test(trimmed)
    ? asNumber
    : trimmed;
}
