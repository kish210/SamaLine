import { useEffect, useRef, useState } from 'react';
import { searchBank, type BankQuestion } from '../../question-bank';
import { QUESTION_TYPE_ICONS, typeLabel } from '../../question-catalog';

interface Props {
  /** سوال‌های انتخاب‌شده، به ترتیبی که کاربر تیک زده. */
  onPick: (questions: BankQuestion[]) => void;
}

/**
 * بانک سوالات آماده.
 *
 * برخلاف «افزودن سوال» که یک سوال خالی از نوع دلخواه می‌سازد، اینجا متن سوال
 * و گزینه‌هایش هم آماده است. چند سوال با هم انتخاب می‌شوند، چون کسی که مثلا
 * دسته‌ی «رستوران» را می‌خواهد معمولا همه‌ی چهار سوالش را می‌خواهد و افزودن
 * یکی‌یکی یعنی چهار بار باز و بسته کردن فهرست.
 */
export function QuestionBankMenu({ onPick }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<BankQuestion[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const groups = searchBank(query);

  /*
   * شناسایی با خود شیء انجام می‌شود نه با عنوان.
   *
   * چند سوال در بانک عنوان یکسان دارند (مثلا «بله/خیر»های مختلف)؛ با کلید
   * متنی، تیک زدن یکی، دیگری را هم تیک‌خورده نشان می‌داد.
   */
  const toggle = (question: BankQuestion) =>
    setPicked((prev) =>
      prev.includes(question)
        ? prev.filter((q) => q !== question)
        : [...prev, question],
    );

  const confirm = () => {
    if (!picked.length) return;
    onPick(picked);
    setPicked([]);
    setQuery('');
    setOpen(false);
  };

  return (
    <div className="add-question" ref={wrapRef}>
      <button
        type="button"
        className="secondary"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        ★ بانک سوالات
      </button>

      {open && (
        <div className="type-menu bank-menu">
          <input
            autoFocus
            className="type-search"
            placeholder="جستجو در سوال‌های آماده…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          {groups.length === 0 && (
            <p className="hint">سوالی با این عبارت پیدا نشد.</p>
          )}

          {groups.map((group) => (
            <div key={group.title} className="type-group">
              <span className="type-group-label">{group.title}</span>
              <div className="bank-list">
                {group.questions.map((question, index) => (
                  <label
                    key={`${group.title}-${index}`}
                    className={
                      picked.includes(question)
                        ? 'bank-item picked'
                        : 'bank-item'
                    }
                  >
                    <input
                      type="checkbox"
                      checked={picked.includes(question)}
                      onChange={() => toggle(question)}
                    />
                    <span className="type-icon" aria-hidden="true">
                      {QUESTION_TYPE_ICONS[question.type]}
                    </span>
                    <span className="bank-title">
                      {question.title}
                      <small>{typeLabel(question.type)}</small>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}

          <div className="inline-form bank-actions">
            <button type="button" onClick={confirm} disabled={!picked.length}>
              {picked.length
                ? `افزودن ${picked.length} سوال`
                : 'سوالی انتخاب نشده'}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => setOpen(false)}
            >
              انصراف
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
