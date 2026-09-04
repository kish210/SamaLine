import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { describeError, formsApi } from '../../api';

interface Props {
  formId: string;
  settings: Record<string, unknown>;
}

interface EdgePages {
  startPageEnabled: boolean;
  startPageText: string;
  endPageEnabled: boolean;
  endPageText: string;
}

const asText = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value : fallback;

/**
 * صفحه‌ی شروع و صفحه‌ی پایان به‌عنوان دو آیتم مستقل فرم.
 *
 * پیش از این متن این دو صفحه فقط در تنظیمات خام فرم بود و در فرم‌ساز
 * دیده نمی‌شد، در حالی که پاسخ‌دهنده اول و آخر همین‌ها را می‌بیند.
 */
export function EdgePagesEditor({ formId, settings }: Props) {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [value, setValue] = useState<EdgePages>({
    // پیش‌فرض سرور: صفحه‌ی شروع روشن مگر صریحا خاموش شده باشد.
    startPageEnabled: settings.startPageEnabled !== false,
    startPageText: asText(settings.startPageText),
    endPageEnabled: settings.endPageEnabled !== false,
    endPageText: asText(settings.endPageText),
  });

  const set = <K extends keyof EdgePages>(key: K, next: EdgePages[K]) =>
    setValue((prev) => ({ ...prev, [key]: next }));

  const save = useMutation({
    mutationFn: () =>
      formsApi.update(formId, { settings: { ...settings, ...value } }),
    onSuccess: async () => {
      setError(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      await queryClient.invalidateQueries({ queryKey: ['form', formId] });
    },
    onError: (err) => setError(describeError(err)),
  });

  return (
    <section className="card edge-pages">
      <div className="section-head">
        <h3>صفحه شروع و پایان</h3>
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

      <div className="edge-page">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={value.startPageEnabled}
            onChange={(e) => set('startPageEnabled', e.target.checked)}
          />
          نمایش صفحه‌ی شروع
        </label>
        <textarea
          rows={2}
          disabled={!value.startPageEnabled}
          placeholder="به فرم خوش آمدید"
          value={value.startPageText}
          onChange={(e) => set('startPageText', e.target.value)}
        />
      </div>

      <div className="edge-page">
        <label className="checkbox">
          <input
            type="checkbox"
            checked={value.endPageEnabled}
            onChange={(e) => set('endPageEnabled', e.target.checked)}
          />
          نمایش صفحه‌ی پایان
        </label>
        <textarea
          rows={2}
          disabled={!value.endPageEnabled}
          placeholder="از پاسخ شما سپاسگزاریم"
          value={value.endPageText}
          onChange={(e) => set('endPageText', e.target.value)}
        />
      </div>
    </section>
  );
}
