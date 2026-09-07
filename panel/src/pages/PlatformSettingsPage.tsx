import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { describeError, platformApi } from '../api';
import type { PlatformSettings } from '../api';
import { TelegramCard } from './TelegramCard';

const EMPTY: PlatformSettings = {
  footerEnabled: true,
  footerText: '',
  footerUrl: '',
};

/**
 * تنظیمات سراسری سکو — فقط برای مدیر کل سامانه.
 *
 * پنهان بودن این صفحه از بقیه فقط تجربه‌ی کاربری است؛ اعمال واقعی دسترسی
 * سمت سرور با گارد سوپرادمین انجام می‌شود، پس دست‌کاری پنل چیزی را باز
 * نمی‌کند.
 */
export function PlatformSettingsPage() {
  const queryClient = useQueryClient();
  const [value, setValue] = useState<PlatformSettings>(EMPTY);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const settings = useQuery({
    queryKey: ['platform-settings'],
    queryFn: platformApi.getSettings,
  });

  useEffect(() => {
    if (settings.data) {
      setValue({
        footerEnabled: settings.data.footerEnabled,
        footerText: settings.data.footerText,
        footerUrl: settings.data.footerUrl,
      });
    }
  }, [settings.data]);

  const save = useMutation({
    mutationFn: () => platformApi.updateSettings(value),
    onSuccess: async () => {
      setError(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      await queryClient.invalidateQueries({ queryKey: ['platform-settings'] });
    },
    onError: (err) => setError(describeError(err)),
  });

  const set = <K extends keyof PlatformSettings>(
    key: K,
    next: PlatformSettings[K],
  ) => setValue((prev) => ({ ...prev, [key]: next }));

  if (settings.isLoading) return <div className="page">در حال بارگذاری…</div>;

  if (settings.isError) {
    return (
      <div className="page">
        <h1>تنظیمات سامانه</h1>
        <p className="error">{describeError(settings.error)}</p>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>تنظیمات سامانه</h1>
        <div className="header-actions">
          {saved && <span className="saved">ذخیره شد</span>}
          <button
            type="button"
            disabled={save.isPending}
            onClick={() => save.mutate()}
          >
            ذخیره
          </button>
        </div>
      </header>

      {error && <p className="error">{error}</p>}

      <section className="card">
        <div className="section-head">
          <h3>نوار پایین فرم‌ها</h3>
        </div>

        <p className="hint">
          این نوار پایین همه‌ی فرم‌های عمومی همه‌ی سازمان‌ها نمایش داده می‌شود.
          صاحبان فرم به آن دسترسی ندارند.
        </p>

        <label className="checkbox">
          <input
            type="checkbox"
            checked={value.footerEnabled}
            onChange={(e) => set('footerEnabled', e.target.checked)}
          />
          نمایش نوار پایین
        </label>

        <label>
          متن نوار
          <input
            maxLength={200}
            placeholder="شرکت سماع رایانه کیش"
            disabled={!value.footerEnabled}
            value={value.footerText}
            onChange={(e) => set('footerText', e.target.value)}
          />
        </label>

        <label>
          نشانی مقصد
          <input
            dir="ltr"
            maxLength={300}
            placeholder="https://kishwifi.com"
            disabled={!value.footerEnabled}
            value={value.footerUrl}
            onChange={(e) => set('footerUrl', e.target.value)}
          />
        </label>

        <p className="hint">
          خالی گذاشتن متن یا نشانی یعنی استفاده از مقدار پیش‌فرض سامانه. فقط
          نشانی http یا https پذیرفته می‌شود.
        </p>

        <div
          className="footer-preview"
          style={{ visibility: value.footerEnabled ? 'visible' : 'hidden' }}
        >
          {value.footerText || 'شرکت سماع رایانه کیش'}
        </div>
      </section>

      <PlatformTelegram />
    </div>
  );
}

/**
 * تنظیم ربات تلگرام هر مجموعه، از پنل سوپرادمین.
 *
 * همان کارت پنل سازمان استفاده می‌شود، فقط با یک انتخابگر فضای کاری بالای
 * آن. بازنویسی جداگانه یعنی دو رابط که با گذشت زمان از هم واگرا می‌شوند.
 */
function PlatformTelegram() {
  const [workspaceId, setWorkspaceId] = useState('');

  const workspaces = useQuery({
    queryKey: ['platform-workspaces'],
    queryFn: platformApi.workspaces,
  });

  const list = workspaces.data ?? [];

  return (
    <section className="card">
      <div className="section-head">
        <h3>ربات تلگرام مجموعه‌ها</h3>
      </div>

      <p className="hint">
        برای هر مجموعه می‌توانید ربات را تنظیم کنید و مشخص کنید پاسخ‌های هر
        فرم به کدام مدیر برود.
      </p>

      {workspaces.isLoading && <p>در حال بارگذاری فضاهای کاری…</p>}

      {list.length > 0 && (
        <label>
          <span className="field-label">مجموعه</span>
          <select
            value={workspaceId}
            onChange={(e) => setWorkspaceId(e.target.value)}
          >
            <option value="">یک مجموعه را انتخاب کنید…</option>
            {list.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.organizationName} — {workspace.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {workspaceId && (
        <TelegramCard key={workspaceId} workspaceId={workspaceId} />
      )}
    </section>
  );
}
