import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { describeError, formsApi } from '../../api';

interface Props {
  formId: string;
  settings: Record<string, unknown>;
  /** فرم بخش دارد؟ هشدار فقط به اعضای بخش می‌رود. */
  hasDepartment: boolean;
}

interface ChecklistValue {
  enabled: boolean;
  cadence: 'daily' | 'weekly';
  dueHour: number;
  weekday: number;
}

const WEEKDAYS = [
  'شنبه',
  'یکشنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنج‌شنبه',
  'جمعه',
];

/**
 * چک‌لیستِ موعددار.
 *
 * فرم را «چک‌لیست روزانه/هفتگی» می‌کند: اگر تا ساعتِ مقرر پر نشود، سامانه به
 * اعضای بخشِ همان فرم ایمیلِ هشدار می‌فرستد. برای همین فقط روی فرمِ بخشی
 * معنی دارد.
 */
export function ChecklistEditor({ formId, settings, hasDepartment }: Props) {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initial = (settings.checklist ?? {}) as Record<string, unknown>;
  const [value, setValue] = useState<ChecklistValue>({
    enabled: initial.enabled === true,
    cadence: initial.cadence === 'weekly' ? 'weekly' : 'daily',
    dueHour: Number.isFinite(Number(initial.dueHour))
      ? Number(initial.dueHour)
      : 20,
    weekday: Number.isFinite(Number(initial.weekday))
      ? Number(initial.weekday)
      : 0,
  });

  const set = <K extends keyof ChecklistValue>(key: K, next: ChecklistValue[K]) =>
    setValue((prev) => ({ ...prev, [key]: next }));

  const save = useMutation({
    mutationFn: () =>
      formsApi.update(formId, {
        // lastAlertKey دستِ سرور است؛ اینجا فقط تنظیماتِ کاربر نوشته می‌شود.
        settings: { ...settings, checklist: value },
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
        <h3>چک‌لیستِ موعددار</h3>
        {saved && <span className="saved">ذخیره شد</span>}
      </div>

      {error && <p className="error">{error}</p>}

      <label className="checkbox">
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(e) => set('enabled', e.target.checked)}
        />
        این فرم باید به‌صورت دوره‌ای پر شود
      </label>

      <div className="form-grid" style={{ opacity: value.enabled ? 1 : 0.5 }}>
        <label>
          <span className="field-label">هر چند وقت</span>
          <select
            value={value.cadence}
            disabled={!value.enabled}
            onChange={(e) =>
              set('cadence', e.target.value as ChecklistValue['cadence'])
            }
          >
            <option value="daily">روزانه</option>
            <option value="weekly">هفتگی</option>
          </select>
        </label>

        {value.cadence === 'weekly' && (
          <label>
            <span className="field-label">روز هفته</span>
            <select
              value={value.weekday}
              disabled={!value.enabled}
              onChange={(e) => set('weekday', Number(e.target.value))}
            >
              {WEEKDAYS.map((name, i) => (
                <option key={i} value={i}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label>
          <span className="field-label">مهلت تا ساعت</span>
          <input
            type="number"
            min={0}
            max={23}
            disabled={!value.enabled}
            value={value.dueHour}
            onChange={(e) => set('dueHour', Number(e.target.value))}
          />
        </label>
      </div>

      <div className="inline-form">
        <button
          type="button"
          disabled={save.isPending}
          onClick={() => save.mutate()}
        >
          ذخیره
        </button>
      </div>

      {value.enabled && !hasDepartment && (
        <p className="error">
          این فرم بخش ندارد؛ هشدار به کسی نمی‌رسد. اول در «بخش و نوع فرم»
          بخشش را تعیین کنید.
        </p>
      )}
      {value.enabled && hasDepartment && (
        <p className="hint">
          اگر تا ساعتِ تعیین‌شده پر نشود، به اعضای بخشِ این فرم ایمیلِ هشدار
          می‌رود (یک بار در هر دوره).
        </p>
      )}
    </section>
  );
}
