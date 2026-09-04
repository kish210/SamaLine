import { useEffect, useRef, useState } from 'react';
import {
  QUESTION_CATEGORIES,
  QUESTION_TYPE_ICONS,
  typeLabel,
} from '../../question-catalog';
import type { QuestionType } from '../../types';

interface Props {
  onPick: (type: QuestionType) => void;
}

/**
 * فهرست افزودن سوال، دسته‌بندی‌شده و با جستجو.
 *
 * پیش از این فقط یک دکمه‌ی «افزودن سوال» بود که سوال متنی می‌ساخت و کاربر
 * باید نوعش را از یک select با ۲۴ گزینه عوض می‌کرد.
 */
export function AddQuestionMenu({ onPick }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const needle = query.trim();
  const categories = QUESTION_CATEGORIES.map((category) => ({
    ...category,
    types: needle
      ? category.types.filter((type) => typeLabel(type).includes(needle))
      : category.types,
  })).filter((category) => category.types.length > 0);

  const pick = (type: QuestionType) => {
    onPick(type);
    setOpen(false);
    setQuery('');
  };

  return (
    <div className="add-question" ref={wrapRef}>
      <button
        type="button"
        className="secondary"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        + افزودن سوال
      </button>

      {open && (
        <div className="type-menu">
          <input
            autoFocus
            className="type-search"
            placeholder="جستجوی نوع سوال…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          {categories.length === 0 && (
            <p className="hint">نوعی با این نام پیدا نشد.</p>
          )}

          {categories.map((category) => (
            <div key={category.key} className="type-group">
              <span className="type-group-label">{category.label}</span>
              <div className="type-grid">
                {category.types.map((type) => (
                  <button
                    key={type}
                    type="button"
                    className="type-chip"
                    onClick={() => pick(type)}
                  >
                    <span className="type-icon" aria-hidden="true">
                      {QUESTION_TYPE_ICONS[type]}
                    </span>
                    {typeLabel(type)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
