import { useQuery } from '@tanstack/react-query';
import { formsApi } from '../api';
import type { FormTemplateSummary } from '../api';

interface Props {
  value: string;
  onChange: (key: string) => void;
}

/**
 * انتخاب قالب آماده هنگام ساخت فرم.
 *
 * قالب‌ها از سرور می‌آیند نه از یک فهرست تکراری در پنل؛ ساختارشان هم سمت
 * سرور باز می‌شود، پس اینجا فقط فراداده لازم است.
 */
export function TemplatePicker({ value, onChange }: Props) {
  const templates = useQuery({
    queryKey: ['form-templates'],
    queryFn: formsApi.templates,
    // قالب‌ها ثابت‌اند؛ نیازی به بازخوانی مکرر نیست.
    staleTime: 60 * 60 * 1000,
  });

  if (templates.isLoading) return <p className="hint">در حال بارگذاری قالب‌ها…</p>;
  if (!templates.data?.length) return null;

  const grouped = templates.data.reduce<Record<string, FormTemplateSummary[]>>(
    (acc, template) => {
      (acc[template.category] ??= []).push(template);
      return acc;
    },
    {},
  );

  return (
    <div className="template-picker">
      <span className="field-label">قالب فرم</span>

      {Object.entries(grouped).map(([category, items]) => (
        <div key={category} className="template-group">
          <span className="template-group-label">{category}</span>
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
                onClick={() => onChange(template.key)}
              >
                <span className="template-icon" aria-hidden="true">
                  {template.icon}
                </span>
                <span className="template-body">
                  <strong>{template.title}</strong>
                  <small>{template.summary}</small>
                  <span className="template-count">
                    {template.questionCount} سوال
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
