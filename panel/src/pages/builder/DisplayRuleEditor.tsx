import { useState } from 'react';
import type { DisplayRule, FormPage } from '../../types';
import {
  OPERATORS,
  coerce,
  needsValue as operatorNeedsValue,
  operatorLabel,
} from './logic-operators';

const PAGE_PREFIX = 'page:';

interface Props {
  pages: FormPage[];
  rules: DisplayRule[];
  onChange: (rules: DisplayRule[]) => void;
}

interface Target {
  key: string;
  label: string;
}

/**
 * ساخت و ویرایش قوانین نمایش (`logic.display`).
 *
 * این همان چیزی است که «سوال دروازه‌ای» می‌سازد: تا وقتی مهمان نگفته از
 * رستوران استفاده کرده، سوال‌های امتیاز رستوران نباید دیده شوند. پیش از این
 * فقط قالب‌های آماده چنین قانونی داشتند و در پنل هیچ راهی برای ساختنش نبود.
 *
 * مثل ویرایشگر پرش، عمدا فقط یک شرط تکی گرفته می‌شود. قانون‌هایی که از قالب
 * آمده‌اند و شرط پیچیده‌تری دارند، خوانده و دست‌نخورده نگه داشته می‌شوند.
 */
export function DisplayRuleEditor({ pages, rules, onChange }: Props) {
  const [draft, setDraft] = useState<number | 'new' | null>(null);

  const targets: Target[] = pages.flatMap((page) => [
    { key: PAGE_PREFIX + page.id, label: `صفحه: ${page.title || page.id}` },
    ...(page.questions ?? []).map((q) => ({
      key: q.id,
      label: q.title || q.id,
    })),
  ]);

  const label = (key: string) =>
    targets.find((t) => t.key === key)?.label ?? key;

  const remove = (index: number) => {
    onChange(rules.filter((_, i) => i !== index));
    setDraft(null);
  };

  const save = (rule: DisplayRule, index: number | 'new') => {
    onChange(
      index === 'new'
        ? [...rules, rule]
        : rules.map((old, i) => (i === index ? rule : old)),
    );
    setDraft(null);
  };

  return (
    <div className="card display-rules">
      <h4>قوانین نمایش</h4>
      <p className="hint">
        سوال یا صفحه‌ای که قانونی ندارد همیشه دیده می‌شود. با افزودن قانون
        می‌توانید نمایشش را به پاسخ یک سوال دیگر گره بزنید.
      </p>

      {rules.length === 0 && <p className="empty">هنوز قانونی تعریف نشده.</p>}

      <ul className="rule-list">
        {rules.map((rule, index) => (
          <li key={index}>
            <span>{describe(rule, label)}</span>
            <span className="inline-form">
              <button
                type="button"
                className="secondary"
                onClick={() => setDraft(index)}
              >
                ویرایش
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => remove(index)}
              >
                حذف
              </button>
            </span>
          </li>
        ))}
      </ul>

      {draft === null ? (
        <button type="button" onClick={() => setDraft('new')}>
          افزودن قانون نمایش
        </button>
      ) : (
        <RuleForm
          key={String(draft)}
          targets={targets}
          pages={pages}
          rule={draft === 'new' ? undefined : rules[draft]}
          onSave={(rule) => save(rule, draft)}
          onCancel={() => setDraft(null)}
        />
      )}
    </div>
  );
}

interface FormProps {
  targets: Target[];
  pages: FormPage[];
  rule?: DisplayRule;
  onSave: (rule: DisplayRule) => void;
  onCancel: () => void;
}

function RuleForm({ targets, pages, rule, onSave, onCancel }: FormProps) {
  const questions = pages.flatMap((page) =>
    (page.questions ?? []).map((q) => ({ id: q.id, title: q.title || q.id })),
  );

  const condition = readCondition(rule);

  const [target, setTarget] = useState(
    rule?.targetPageId
      ? PAGE_PREFIX + rule.targetPageId
      : (rule?.targetQuestionId ?? targets[0]?.key ?? ''),
  );
  const [action, setAction] = useState<'show' | 'hide'>(rule?.action ?? 'show');
  const [source, setSource] = useState(
    condition?.source ?? questions[0]?.id ?? '',
  );
  const [operator, setOperator] = useState(condition?.operator ?? 'equals');
  const [value, setValue] = useState(
    condition?.value === undefined ? '' : String(condition.value),
  );

  const showsValue = operatorNeedsValue(operator);
  const complex = (rule?.when?.conditions?.length ?? 0) > 1;

  /*
   * هدفی که خودش منبع شرط است، شرطش هرگز قابل پاسخ دادن نیست: تا دیده نشود
   * پاسخی ندارد و تا پاسخی ندارد دیده نمی‌شود.
   */
  const selfReference = target === source;

  const submit = () => {
    const isPage = target.startsWith(PAGE_PREFIX);
    onSave({
      ...(isPage
        ? { targetPageId: target.slice(PAGE_PREFIX.length) }
        : { targetQuestionId: target }),
      action,
      when: {
        combinator: 'and',
        conditions: [
          { source, operator, ...(showsValue ? { value: coerce(value) } : {}) },
        ],
      },
    });
  };

  return (
    <div className="card skip-editor">
      <h4>{rule ? 'ویرایش قانون نمایش' : 'قانون نمایش تازه'}</h4>

      {complex && (
        <p className="error">
          این قانون چند شرط دارد و اینجا فقط شرط اول ویرایش می‌شود؛ ذخیره،
          بقیه‌ی شرط‌ها را حذف می‌کند.
        </p>
      )}

      <div className="form-grid">
        <label>
          <span className="field-label">هدف</span>
          <select value={target} onChange={(e) => setTarget(e.target.value)}>
            {targets.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="field-label">رفتار</span>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value as 'show' | 'hide')}
          >
            <option value="show">نمایش داده شود اگر</option>
            <option value="hide">پنهان شود اگر</option>
          </select>
        </label>
      </div>

      <div className="form-grid three">
        <label>
          <span className="field-label">پاسخ سوال</span>
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            {questions.map((q) => (
              <option key={q.id} value={q.id}>
                {q.title}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="field-label">شرط</span>
          <select value={operator} onChange={(e) => setOperator(e.target.value)}>
            {OPERATORS.map((op) => (
              <option key={op.value} value={op.value}>
                {op.label}
              </option>
            ))}
          </select>
        </label>

        {showsValue && (
          <label>
            <span className="field-label">مقدار</span>
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="مثلا: استفاده کردم"
            />
          </label>
        )}
      </div>

      {selfReference && (
        <p className="error">
          هدف و منبع شرط یک سوال‌اند؛ این قانون هیچ‌وقت برقرار نمی‌شود.
        </p>
      )}

      <div className="inline-form">
        <button
          type="button"
          onClick={submit}
          disabled={!target || !source || selfReference}
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
 * شرط یک قانون را می‌خواند، از هر دو شکلی که بک‌اند می‌پذیرد.
 *
 * قالب‌های آماده شکل مسطح (`sourceQuestionId`) را می‌نویسند؛ بدون این
 * یکسان‌سازی، باز کردن چنین قانونی در ویرایشگر شرطش را خالی نشان می‌داد و
 * ذخیره، سوال دروازه‌ای را برای همه‌ی پاسخ‌دهنده‌ها باز می‌کرد.
 */
function readCondition(rule?: DisplayRule) {
  const grouped = rule?.when?.conditions?.[0];
  if (grouped) return grouped;
  if (rule?.sourceQuestionId && rule.operator) {
    return {
      source: rule.sourceQuestionId,
      operator: rule.operator,
      value: rule.value,
    };
  }
  return undefined;
}

/** توصیف یک‌خطی قانون برای فهرست. */
function describe(rule: DisplayRule, label: (key: string) => string): string {
  const target = rule.targetPageId
    ? label(PAGE_PREFIX + rule.targetPageId)
    : label(rule.targetQuestionId ?? '');
  const verb = rule.action === 'hide' ? 'پنهان شود' : 'نمایش داده شود';
  const condition = readCondition(rule);

  if (!condition) return `«${target}» همیشه ${verb}`;

  const value = operatorNeedsValue(condition.operator)
    ? ` «${String(condition.value ?? '')}»`
    : '';
  return `«${target}» ${verb} اگر پاسخ «${label(condition.source)}» ${operatorLabel(condition.operator)}${value}`;
}
