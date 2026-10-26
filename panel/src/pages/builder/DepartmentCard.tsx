import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { departmentsApi, describeError, formsApi } from '../../api';

interface Props {
  formId: string;
  /** بخشِ فعلیِ فرم؛ null یعنی نظرسنجیِ عمومی. */
  departmentId: string | null;
}

/**
 * تعیین اینکه فرم «نظرسنجی عمومی» است یا «عملیاتیِ یک بخش».
 *
 * انتخاب بخش دو اثر دارد: فقط اعضای همان بخش (و مدیران) فرم را در فهرست
 * می‌بینند، و اگر انتشار روی حالت «کارمند» باشد فقط همان‌ها می‌توانند پرش
 * کنند. هر دو بررسی سمت سرور است؛ این فقط انتخابش را ممکن می‌کند.
 */
export function DepartmentCard({ formId, departmentId }: Props) {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const departments = useQuery({
    queryKey: ['departments'],
    queryFn: departmentsApi.list,
  });

  const save = useMutation({
    mutationFn: (next: string | null) =>
      formsApi.update(formId, { departmentId: next }),
    onSuccess: async () => {
      setError(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      await queryClient.invalidateQueries({ queryKey: ['form', formId] });
    },
    onError: (err) => setError(describeError(err)),
  });

  const current = departmentId ?? '';

  return (
    <section className="card">
      <div className="section-head">
        <h3>بخش و نوع فرم</h3>
        {saved && <span className="saved">ذخیره شد</span>}
      </div>

      {error && <p className="error">{error}</p>}

      <label>
        <span className="field-label">این فرم مال کدام بخش است؟</span>
        <select
          value={current}
          onChange={(e) => save.mutate(e.target.value || null)}
          disabled={save.isPending}
        >
          <option value="">نظرسنجی عمومی (بدون بخش)</option>
          {departments.data?.map((dept) => (
            <option key={dept.id} value={dept.id}>
              {dept.name}
            </option>
          ))}
        </select>
      </label>

      <p className="hint">
        {current
          ? 'فرم عملیاتی: فقط اعضای این بخش و مدیران آن را می‌بینند. برای اینکه پر کردنش هم نیاز به ورود داشته باشد، در «انتشار» حالت «کارمند» را انتخاب کنید.'
          : 'نظرسنجی عمومی: هر کسی با داشتن لینک می‌تواند پرش کند.'}
      </p>

      {departments.data?.length === 0 && (
        <p className="hint">
          هنوز بخشی تعریف نشده؛ از «تنظیمات → بخش‌های سازمان» بخش بسازید.
        </p>
      )}
    </section>
  );
}
