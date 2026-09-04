import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { describeError, formsApi } from '../../api';
import {
  THEME_PRESETS,
  canonicalPreset,
  presetBackground,
} from '../../theme-presets';

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
  gradientColor: string;
  gradientAngle: number;
  oneQuestionPerStep: boolean;
}


const EMPTY: ThemeValue = {
  preset: 'default',
  primaryColor: '#111827',
  backgroundColor: '#f8fafc',
  surfaceColor: '#ffffff',
  textColor: '#111827',
  cornerRadius: 14,
  logoUrl: '',
  backgroundImageUrl: '',
  gradientColor: '',
  gradientAngle: 25,
  oneQuestionPerStep: false,
};

/** ویرایش ظاهر و برندینگ فرم. */
export function ThemeEditor({ formId, settings }: Props) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const stored = (settings.theme ?? {}) as Partial<ThemeValue> | string;
  // سازگاری با داده‌ی قدیمی که تم را رشته ذخیره می‌کرد.
  const storedObject: Partial<ThemeValue> =
    typeof stored === 'string' ? { preset: stored } : stored;

  /*
   * پایه‌ی رنگ‌ها، خودِ تم انتخاب‌شده است نه پیش‌فرض سیاه.
   *
   * تم آماده معمولا فقط با نام ذخیره می‌شود و رنگ‌هایش را سرور اعمال
   * می‌کند. اگر ویرایشگر رنگ‌ها را از EMPTY بخواند، سلکتورها رنگی را نشان
   * می‌دهند که فرم واقعی ندارد و اولین «ذخیره» همان رنگِ اشتباه را روی فرم
   * می‌نویسد — یعنی ظاهر فرم بدون اینکه کاربر چیزی عوض کرده باشد خراب می‌شود.
   */
  const presetBase = THEME_PRESETS.find(
    (item) => item.key === canonicalPreset(storedObject.preset ?? 'default'),
  );

  const initial: ThemeValue = {
    ...EMPTY,
    ...(presetBase
      ? {
          primaryColor: presetBase.primaryColor,
          backgroundColor: presetBase.backgroundColor,
          surfaceColor: presetBase.surfaceColor ?? EMPTY.surfaceColor,
          textColor: presetBase.textColor,
          cornerRadius: presetBase.cornerRadius ?? EMPTY.cornerRadius,
          gradientColor: presetBase.gradientColor ?? '',
        }
      : {}),
    // مقدارِ صریحِ ذخیره‌شده بر تم اولویت دارد.
    ...storedObject,
  };

  const [theme, setTheme] = useState<ThemeValue>(initial);

  const set = <K extends keyof ThemeValue>(key: K, value: ThemeValue[K]) =>
    setTheme((prev) => ({ ...prev, [key]: value }));

  /**
   * انتخاب یک تم آماده.
   *
   * رنگ‌ها هم واقعا نوشته می‌شوند، نه فقط نام تم: اگر کاربر قبلا رنگی را
   * دستی عوض کرده باشد، آن رنگ بر تمِ تازه‌انتخاب‌شده اولویت پیدا می‌کند و
   * نتیجه با بندانگشتی‌ای که کلیک شده فرق می‌کند.
   */
  const applyPreset = (key: string) => {
    const preset = THEME_PRESETS.find((item) => item.key === key);
    if (!preset) return;
    setTheme({
      ...EMPTY,
      preset: key,
      primaryColor: preset.primaryColor,
      backgroundColor: preset.backgroundColor,
      surfaceColor: preset.surfaceColor ?? EMPTY.surfaceColor,
      textColor: preset.textColor,
      cornerRadius: preset.cornerRadius ?? EMPTY.cornerRadius,
      gradientColor: preset.gradientColor ?? '',
      // مواردی که به تم ربط ندارند حفظ می‌شوند.
      logoUrl: theme.logoUrl,
      backgroundImageUrl: theme.backgroundImageUrl,
      oneQuestionPerStep: theme.oneQuestionPerStep,
      gradientAngle: theme.gradientAngle,
    });
  };

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

      <div className="preset-block">
        <span className="field-label">تم آماده</span>
        <div className="preset-grid">
          {THEME_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              title={preset.label}
              className={
                canonicalPreset(theme.preset) === preset.key
                  ? 'preset-card active'
                  : 'preset-card'
              }
              onClick={() => applyPreset(preset.key)}
            >
              {/* بندانگشتی، همان ترکیب رنگی فرم واقعی را نشان می‌دهد. */}
              <span
                className="preset-thumb"
                style={{ background: presetBackground(preset) }}
              >
                <span
                  className="preset-thumb-card"
                  style={{
                    background: preset.surfaceColor ?? '#ffffff',
                    borderRadius: (preset.cornerRadius ?? 14) / 2,
                  }}
                >
                  <span
                    className="preset-thumb-line"
                    style={{ background: preset.textColor, opacity: 0.5 }}
                  />
                  <span
                    className="preset-thumb-button"
                    style={{ background: preset.primaryColor }}
                  />
                </span>
              </span>
              {preset.label}
            </button>
          ))}
        </div>
      </div>

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

      <label className="checkbox">
        <input
          type="checkbox"
          checked={theme.oneQuestionPerStep}
          onChange={(e) => set('oneQuestionPerStep', e.target.checked)}
        />
        نمایش تک‌سوالی (هر گام یک سوال)
      </label>

      <div className="grid-2">
        <label>
          رنگ گرادیان پس‌زمینه
          <div className="inline-form">
            <input
              type="color"
              value={theme.gradientColor || theme.backgroundColor}
              onChange={(e) => set('gradientColor', e.target.value)}
            />
            {theme.gradientColor && (
              <button
                type="button"
                className="secondary"
                onClick={() => set('gradientColor', '')}
              >
                حذف
              </button>
            )}
          </div>
        </label>
        <label>
          زاویه گرادیان: {theme.gradientAngle}°
          <input
            type="range"
            min={0}
            max={359}
            value={theme.gradientAngle}
            onChange={(e) => set('gradientAngle', Number(e.target.value))}
          />
        </label>
      </div>

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
          background: theme.gradientColor
            ? `linear-gradient(${theme.gradientAngle}deg, ${theme.backgroundColor} 15%, ${theme.gradientColor} 100%)`
            : theme.backgroundColor,
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
