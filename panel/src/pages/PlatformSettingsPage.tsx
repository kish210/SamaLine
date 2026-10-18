import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { describeError, platformApi } from '../api';
import type { PlatformSettings } from '../api';
import { TelegramCard } from './TelegramCard';
import { ServiceMonitorCard } from './ServiceMonitorCard';
import { OrganizationPlansCard } from './OrganizationPlansCard';

const EMPTY: PlatformSettings = {
  footerEnabled: true,
  footerText: '',
  footerUrl: '',
  registrationEnabled: true,
  aiProvider: 'mock',
  aiBaseUrl: '',
  aiModel: '',
  aiApiKeySet: false,
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
  // کلید API جدا نگه داشته می‌شود؛ خالی یعنی «دست‌نخورده».
  const [apiKey, setApiKey] = useState('');
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
        registrationEnabled: settings.data.registrationEnabled,
        aiProvider: settings.data.aiProvider,
        aiBaseUrl: settings.data.aiBaseUrl,
        aiModel: settings.data.aiModel,
        aiApiKeySet: settings.data.aiApiKeySet,
      });
      setApiKey('');
    }
  }, [settings.data]);

  const save = useMutation({
    mutationFn: () =>
      platformApi.updateSettings({
        footerEnabled: value.footerEnabled,
        footerText: value.footerText,
        footerUrl: value.footerUrl,
        registrationEnabled: value.registrationEnabled,
        aiProvider: value.aiProvider,
        aiBaseUrl: value.aiBaseUrl,
        aiModel: value.aiModel,
        // فقط وقتی کاربر چیزی تایپ کرده کلید را می‌فرستیم.
        ...(apiKey ? { aiApiKey: apiKey } : {}),
      }),
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

      <section className="card">
        <div className="section-head">
          <h3>ثبت‌نام کاربران</h3>
        </div>

        <p className="hint">
          با خاموش‌کردن ثبت‌نام، دیگر کسی نمی‌تواند حساب و سازمان تازه بسازد؛
          فقط حساب‌های موجود وارد می‌شوند. (اگر هنوز هیچ حسابی ساخته نشده باشد،
          برای راه‌اندازی اولیه ثبت‌نام باز می‌ماند.)
        </p>

        <label className="checkbox">
          <input
            type="checkbox"
            checked={value.registrationEnabled}
            onChange={(e) => set('registrationEnabled', e.target.checked)}
          />
          ثبت‌نام عمومی باز باشد
        </label>
      </section>

      <section className="card">
        <div className="section-head">
          <h3>هوش مصنوعی</h3>
        </div>

        <p className="hint">
          بخش «ساخت پرسشنامه با هوش مصنوعی» از این سرویس استفاده می‌کند. در حالت
          «نمونه» بدون اینترنت یک خروجی ساده می‌سازد. برای نتیجه‌ی واقعی، یک
          سرویس سازگار با OpenAI را وصل کنید — چه مدل محلی، چه API آنلاین.
        </p>

        <label>
          سرویس‌دهنده
          <select
            value={value.aiProvider}
            onChange={(e) =>
              set('aiProvider', e.target.value as 'mock' | 'openai')
            }
          >
            <option value="mock">نمونه (بدون اینترنت)</option>
            <option value="openai">سازگار با OpenAI (محلی یا آنلاین)</option>
          </select>
        </label>

        {value.aiProvider === 'openai' && (
          <>
            <label>
              نشانی پایه (Base URL)
              <input
                dir="ltr"
                maxLength={300}
                placeholder="http://127.0.0.1:11434/v1"
                value={value.aiBaseUrl}
                onChange={(e) => set('aiBaseUrl', e.target.value)}
              />
            </label>

            <label>
              نام مدل
              <input
                dir="ltr"
                maxLength={120}
                placeholder="qwen2.5:3b"
                value={value.aiModel}
                onChange={(e) => set('aiModel', e.target.value)}
              />
            </label>

            <label>
              کلید API
              <input
                dir="ltr"
                type="password"
                maxLength={500}
                placeholder={
                  value.aiApiKeySet
                    ? '••••••• (برای تغییر، کلید تازه بنویسید)'
                    : 'برای مدل محلی هر مقداری مثل ollama'
                }
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </label>

            <p className="hint">
              <b>سبک‌ترین مدل محلی پیشنهادی:</b> با{' '}
              <a href="https://ollama.com" target="_blank" rel="noreferrer">
                Ollama
              </a>{' '}
              مدل <code>qwen2.5:3b</code> (یا <code>llama3.2:3b</code>) را نصب
              کنید؛ نشانی پایه <code dir="ltr">http://127.0.0.1:11434/v1</code>،
              نام مدل <code>qwen2.5:3b</code> و کلید هر مقدار دلخواه. برای کیفیت
              بالاتر <code>qwen2.5:7b</code>. برای API آنلاین، نشانی و کلید همان
              سرویس (مثلا OpenAI) را بگذارید. کلید رمزشده ذخیره می‌شود و دیگر
              نمایش داده نمی‌شود.
            </p>
          </>
        )}
      </section>

      <ServiceMonitorCard />

      <OrganizationPlansCard />

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
