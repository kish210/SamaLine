import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { describeError, formsApi } from '../../api';

interface Props {
  formId: string;
  settings: Record<string, unknown>;
}

interface ReminderValue {
  enabled: boolean;
  delayHours: number;
  channel: 'auto' | 'sms' | 'email';
  message: string;
}

const asText = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value : fallback;

/**
 * تنظیم یادآوری فرم‌های نیمه‌تمام.
 *
 * وقتی کسی فرم را شروع کند و نیمه‌کاره رها کند، اگر شماره یا ایمیلش را در همان
 * پاسخ گذاشته باشد، سامانه پس از تاخیرِ تعیین‌شده یک پیام با لینک ادامه
 * می‌فرستد. یک بار، نه بیشتر.
 *
 * مثل EdgePagesEditor فقط یک برش از settings فرم را می‌نویسد و بقیه را
 * دست‌نخورده نگه می‌دارد.
 */
export function ReminderEditor({ formId, settings }: Props) {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initial = (settings.reminders ?? {}) as Record<string, unknown>;
  const [value, setValue] = useState<ReminderValue>({
    enabled: initial.enabled === true,
    delayHours:
      Number.isFinite(Number(initial.delayHours)) && Number(initial.delayHours) > 0
        ? Number(initial.delayHours)
        : 6,
    channel:
      initial.channel === 'sms' || initial.channel === 'email'
        ? initial.channel
        : 'auto',
    message: asText(initial.message),
  });

  const set = <K extends keyof ReminderValue>(key: K, next: ReminderValue[K]) =>
    setValue((prev) => ({ ...prev, [key]: next }));

  const save = useMutation({
    mutationFn: () =>
      formsApi.update(formId, {
        settings: { ...settings, reminders: value },
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
    <section className="card reminder-editor">
      <div className="section-head">
        <h3>یادآوری فرم نیمه‌تمام</h3>
        <div className="inline-form">
          {saved && <span className="saved">ذخیره شد</span>}
          <button
            type="button"
            disabled={save.isPending}
            onClick={() => save.mutate()}
          >
            ذخیره
          </button>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      <label className="checkbox">
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(e) => set('enabled', e.target.checked)}
        />
        ارسال یادآوری برای کسانی که فرم را نیمه‌کاره رها می‌کنند
      </label>

      <p className="hint">
        فقط وقتی کار می‌کند که پاسخ‌دهنده شماره موبایل یا ایمیلش را پیش از رها
        کردن فرم وارد کرده باشد. پیام یک بار فرستاده می‌شود.
      </p>

      <div className="form-grid" style={{ opacity: value.enabled ? 1 : 0.5 }}>
        <label>
          <span className="field-label">پس از چند ساعت</span>
          <input
            type="number"
            min={1}
            max={72}
            disabled={!value.enabled}
            value={value.delayHours}
            onChange={(e) => set('delayHours', Number(e.target.value))}
          />
        </label>

        <label>
          <span className="field-label">از چه راهی</span>
          <select
            disabled={!value.enabled}
            value={value.channel}
            onChange={(e) =>
              set('channel', e.target.value as ReminderValue['channel'])
            }
          >
            <option value="auto">خودکار (اول پیامک، بعد ایمیل)</option>
            <option value="sms">فقط پیامک</option>
            <option value="email">فقط ایمیل</option>
          </select>
        </label>
      </div>

      <label>
        <span className="field-label">متن پیام (اختیاری)</span>
        <textarea
          rows={2}
          disabled={!value.enabled}
          placeholder="«{form}» را نیمه‌کاره رها کردید. برای ادامه: {link}"
          value={value.message}
          onChange={(e) => set('message', e.target.value)}
        />
      </label>
      <p className="hint">
        در متن، <code>{'{form}'}</code> جای نام فرم و <code>{'{link}'}</code> جای
        لینک ادامه می‌نشیند. اگر خالی بماند، متن پیش‌فرض فرستاده می‌شود.
      </p>
    </section>
  );
}
