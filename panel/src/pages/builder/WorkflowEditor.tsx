import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { departmentsApi, describeError, formsApi } from '../../api';

interface Props {
  formId: string;
  settings: Record<string, unknown>;
}

interface Step {
  departmentId: string;
  label: string;
}

/**
 * گردش‌کارِ بین‌واحدی (#3).
 *
 * یک فهرستِ مرتب از واحدها می‌سازد؛ هر پاسخِ این فرم به‌ترتیب از این واحدها رد
 * می‌شود و هر واحد مرحله‌ی خودش را تأیید/رد می‌کند. تأییدِ هر مرحله پاسخ را به
 * واحدِ بعد می‌برد؛ ردِ هر مرحله آن را متوقف می‌کند. تأییدها در «کارتابلِ تأیید»
 * دیده می‌شوند و هر واحد فقط مرحله‌ی خودش را می‌بیند. در settings.workflow ذخیره
 * می‌شود (بدونِ جدول/مهاجرت).
 */
export function WorkflowEditor({ formId, settings }: Props) {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const departments = useQuery({
    queryKey: ['departments'],
    queryFn: departmentsApi.list,
  });

  const initial = (settings.workflow ?? {}) as { steps?: Step[] };
  const [steps, setSteps] = useState<Step[]>(
    Array.isArray(initial.steps) ? initial.steps : [],
  );

  const deptName = (id: string) =>
    departments.data?.find((d) => d.id === id)?.name ?? id;

  const addStep = () => {
    const first = departments.data?.[0]?.id ?? '';
    setSteps((prev) => [...prev, { departmentId: first, label: '' }]);
  };
  const setStep = (i: number, patch: Partial<Step>) =>
    setSteps((prev) => prev.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const removeStep = (i: number) =>
    setSteps((prev) => prev.filter((_, j) => j !== i));
  const move = (i: number, dir: -1 | 1) =>
    setSteps((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const save = useMutation({
    mutationFn: () =>
      formsApi.update(formId, {
        // فقط مراحلِ معتبر (با واحد) ذخیره می‌شوند.
        settings: {
          ...settings,
          workflow: { steps: steps.filter((s) => s.departmentId) },
        },
      }),
    onSuccess: async () => {
      setError(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      await queryClient.invalidateQueries({ queryKey: ['form', formId] });
    },
    onError: (err) => setError(describeError(err)),
  });

  return (
    <section className="card">
      <div className="section-head">
        <h3>گردش‌کارِ بین‌واحدی</h3>
        {saved && <span className="saved">ذخیره شد</span>}
      </div>

      {error && <p className="error">{error}</p>}

      <p className="hint">
        هر پاسخِ این فرم به‌ترتیبِ زیر از واحدها عبور می‌کند؛ هر واحد مرحله‌ی
        خودش را در «کارتابلِ تأیید» تأیید یا رد می‌کند. بدون مرحله، فرم گردش‌کار
        ندارد.
      </p>

      {departments.data && departments.data.length === 0 && (
        <p className="error">
          هنوز واحدی تعریف نشده؛ اول از «تنظیمات → بخش‌های سازمان» واحد بسازید.
        </p>
      )}

      {steps.length === 0 && <p className="hint">هنوز مرحله‌ای اضافه نشده.</p>}

      {steps.map((step, i) => (
        <div key={i} className="inline-form" style={{ alignItems: 'center' }}>
          <span style={{ minWidth: 28, opacity: 0.7 }}>{i + 1}.</span>
          <label className="inline-select">
            <span>واحدِ مسئول</span>
            <select
              value={step.departmentId}
              onChange={(e) => setStep(i, { departmentId: e.target.value })}
            >
              {(departments.data ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <input
            placeholder="برچسبِ مرحله (اختیاری)"
            value={step.label}
            onChange={(e) => setStep(i, { label: e.target.value })}
          />
          <button type="button" disabled={i === 0} onClick={() => move(i, -1)}>
            ↑
          </button>
          <button
            type="button"
            disabled={i === steps.length - 1}
            onClick={() => move(i, 1)}
          >
            ↓
          </button>
          <button type="button" className="danger" onClick={() => removeStep(i)}>
            حذف
          </button>
        </div>
      ))}

      <div className="inline-form">
        <button
          type="button"
          disabled={!departments.data || departments.data.length === 0}
          onClick={addStep}
        >
          + افزودن مرحله
        </button>
        <button type="button" disabled={save.isPending} onClick={() => save.mutate()}>
          ذخیره‌ی گردش‌کار
        </button>
      </div>

      {steps.length > 0 && (
        <p className="hint">
          مسیر: {steps.map((s) => deptName(s.departmentId)).join(' ← ')}
        </p>
      )}
    </section>
  );
}
