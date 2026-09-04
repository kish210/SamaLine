import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { describeError, formsApi } from '../../api';

interface Props {
  formId: string;
  settings: Record<string, unknown>;
}

interface ThemeValue {
  preset: string;
  primaryColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  cornerRadius: number;
  logoUrl: string;
  backgroundImageUrl: string;
}

const PRESETS: Array<{ value: string; label: string; swatch: string }> = [
  { value: 'default', label: 'پیش‌فرض', swatch: '#111827' },
  { value: 'ocean', label: 'دریایی', swatch: '#0369a1' },
  { value: 'forest', label: 'جنگلی', swatch: '#047857' },
  { value: 'sunset', label: 'غروب', swatch: '#c2410c' },
  { value: 'night', label: 'شب', swatch: '#818cf8' },
];

const EMPTY: ThemeValue = {
  preset: 'default',
  primaryColor: '#111827',
  backgroundColor: '#f8fafc',
  surfaceColor: '#ffffff',
  textColor: '#111827',
  cornerRadius: 14,
  logoUrl: '',
  backgroundImageUrl: '',
};

/** ویرایش ظاهر و برندینگ فرم. */
export function ThemeEditor({ formId, settings }: Props) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const stored = (settings.theme ?? {}) as Partial<ThemeValue> | string;
  const initial: ThemeValue =
    typeof stored === 'string'
      ? { ...EMPTY, preset: stored }
      : { ...EMPTY, ...stored };

  const [theme, setTheme] = useState<ThemeValue>(initial);

  const set = <K extends keyof ThemeValue>(key: K, value: ThemeValue[K]) =>
    setTheme((prev) => ({ ...prev, [key]: value }));

  const save = useMutation({
    mutationFn: () =>
      formsApi.update(formId, { settings: { ...settings, theme } }),
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
        <h3>ظاهر و برندینگ فرم</h3>
        <div className="inline-form">
          {saved && <span className="saved">ذخیره شد</span>}
          <button
            type="button"
            disabled={save.isPending}
            onClick={() => save.mutate()}
          >
            ذخیره ظاهر
          </button>
        </div>
      </div>

      {error && <p className="error-line">{error}</p>}

      <label>
        تم آماده
        <div className="preset-row">
          {PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              className={
                theme.preset === preset.value ? 'preset active' : 'preset'
              }
              onClick={() => set('preset', preset.value)}
            >
              <span
                className="preset-swatch"
                style={{ background: preset.swatch }}
              />
              {preset.label}
            </button>
          ))}
        </div>
      </label>

      <div className="grid-2">
        <label>
          رنگ اصلی
          <input
            type="color"
            value={theme.primaryColor}
            onChange={(e) => set('primaryColor', e.target.value)}
          />
        </label>
        <label>
          رنگ پس‌زمینه
          <input
            type="color"
            value={theme.backgroundColor}
            onChange={(e) => set('backgroundColor', e.target.value)}
          />
        </label>
        <label>
          رنگ کارت فرم
          <input
            type="color"
            value={theme.surfaceColor}
            onChange={(e) => set('surfaceColor', e.target.value)}
          />
        </label>
        <label>
          رنگ متن
          <input
            type="color"
            value={theme.textColor}
            onChange={(e) => set('textColor', e.target.value)}
          />
        </label>
      </div>

      <label>
        گردی گوشه‌ها: {theme.cornerRadius} پیکسل
        <input
          type="range"
          min={0}
          max={40}
          value={theme.cornerRadius}
          onChange={(e) => set('cornerRadius', Number(e.target.value))}
        />
      </label>

      <label>
        نشانی لوگو
        <input
          value={theme.logoUrl}
          placeholder="https://example.com/logo.png"
          onChange={(e) => set('logoUrl', e.target.value)}
        />
      </label>

      <label>
        نشانی تصویر پس‌زمینه
        <input
          value={theme.backgroundImageUrl}
          placeholder="https://example.com/bg.jpg"
          onChange={(e) => set('backgroundImageUrl', e.target.value)}
        />
      </label>

      <div
        className="theme-preview"
        style={{
          background: theme.backgroundColor,
          borderRadius: theme.cornerRadius,
        }}
      >
        <div
          className="theme-preview-card"
          style={{
            background: theme.surfaceColor,
            color: theme.textColor,
            borderRadius: theme.cornerRadius,
          }}
        >
          {theme.logoUrl && (
            <img src={theme.logoUrl} alt="" className="theme-preview-logo" />
          )}
          <strong>پیش‌نمایش فرم</strong>
          <p>نمونه‌ی متن سوال</p>
          <span
            className="theme-preview-button"
            style={{
              background: theme.primaryColor,
              borderRadius: theme.cornerRadius / 2,
            }}
          >
            ثبت پاسخ
          </span>
        </div>
      </div>
    </section>
  );
}
