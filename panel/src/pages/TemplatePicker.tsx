import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { formsApi } from '../api';
import type { FormTemplateSummary } from '../api';

interface Props {
  value: string;
  onChange: (template: FormTemplateSummary) => void;
  /** ساخت فوری فرم از قالب انتخاب‌شده. */
  onCreate?: () => void;
  creating?: boolean;
}

const ALL = '';

/** مقایسه‌ی جستجو: حروف عربی و فارسی یکسان، بدون نیم‌فاصله و بزرگی حروف. */
function normalize(text: string): string {
  return text
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/‌/g, ' ')
    .toLowerCase();
}

/**
 * انتخاب قالب آماده هنگام ساخت فرم.
 *
 * قالب‌ها از سرور می‌آیند نه از یک فهرست تکراری در پنل؛ ساختارشان هم سمت
 * سرور باز می‌شود، پس اینجا فقط فراداده لازم است. با ده‌ها قالب در صنف‌های
 * مختلف، جستجو و فیلتر دسته لازم است تا کاربر قالب صنف خودش را زود پیدا کند.
 */
export function TemplatePicker({ value, onChange, onCreate, creating }: Props) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState(ALL);

  const templates = useQuery({
    queryKey: ['form-templates'],
    queryFn: formsApi.templates,
    // قالب‌ها ثابت‌اند؛ نیازی به بازخوانی مکرر نیست.
    staleTime: 60 * 60 * 1000,
  });

  const all = useMemo(() => templates.data ?? [], [templates.data]);

  // دسته‌ها به همان ترتیبی که سرور فرستاده (سرور مرتبشان کرده است).
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const template of all) {
      counts.set(template.category, (counts.get(template.category) ?? 0) + 1);
    }
    return [...counts.entries()];
  }, [all]);

  const visible = useMemo(() => {
    const needle = normalize(query.trim());
    return all.filter((template) => {
      if (category !== ALL && template.category !== category) return false;
      if (!needle) return true;
      return normalize(
        `${template.title} ${template.summary} ${template.category}`,
      ).includes(needle);
    });
  }, [all, category, query]);

  const grouped = useMemo(
    () =>
      visible.reduce<Record<string, FormTemplateSummary[]>>((acc, template) => {
        (acc[template.category] ??= []).push(template);
        return acc;
      }, {}),
    [visible],
  );

  const selected = all.find((template) => template.key === value);

  if (templates.isLoading) {
    return <p className="hint">در حال بارگذاری قالب‌ها…</p>;
  }
  if (!all.length) return null;

  return (
    <div className="template-picker">
      <div className="template-toolbar">
        <span className="field-label">
          قالب‌های آماده ({all.length.toLocaleString('fa-IR')} قالب)
        </span>
        <input
          type="search"
          className="template-search"
          placeholder="جستجو: رستوران، استخدام، بیمار، NPS…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="template-categories" role="tablist" aria-label="صنف">
        <button
          type="button"
          role="tab"
          aria-selected={category === ALL}
          className={category === ALL ? 'chip active' : 'chip'}
          onClick={() => setCategory(ALL)}
        >
          همه
        </button>
        {categories.map(([name, count]) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={category === name}
            className={category === name ? 'chip active' : 'chip'}
            onClick={() => setCategory(name)}
          >
            {name} <span className="chip-count">{count.toLocaleString('fa-IR')}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 && (
        <p className="hint">
          قالبی با این جستجو پیدا نشد. «فرم خالی» را انتخاب کنید و خودتان
          بسازید.
        </p>
      )}

      {Object.entries(grouped).map(([groupName, items]) => (
        <div key={groupName} className="template-group">
          <span className="template-group-label">{groupName}</span>
          <div className="template-grid">
            {items.map((template) => (
              <button
                key={template.key}
                type="button"
                className={
                  value === template.key
                    ? 'template-card active'
                    : 'template-card'
                }
                aria-pressed={value === template.key}
                onClick={() => onChange(template)}
              >
                <span className="template-icon" aria-hidden="true">
                  {template.icon}
                </span>
                <span className="template-body">
                  <strong>{template.title}</strong>
                  <small>{template.summary}</small>
                  <span className="template-count">
                    {template.questionCount.toLocaleString('fa-IR')} سوال
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}

      {selected && onCreate && (
        <div className="template-selected">
          <span>
            {selected.icon} قالب انتخاب‌شده: <strong>{selected.title}</strong>
          </span>
          <button type="button" disabled={creating} onClick={onCreate}>
            {creating ? 'در حال ساخت…' : 'ساخت فرم از این قالب'}
          </button>
        </div>
      )}
    </div>
  );
}
