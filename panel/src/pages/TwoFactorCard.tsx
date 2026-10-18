import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { renderSVG } from 'uqr';
import { describeError, twoFactorApi } from '../api';

/**
 * ورود دومرحله‌ای کاربر پنل.
 *
 * سه حالت: خاموش → راه‌اندازی (QR و کلید نشان داده می‌شود) → با اولین کد
 * درست روشن. اگر رمز عبور لو برود، بدون گوشیِ کاربر ورود ممکن نیست.
 */
export function TwoFactorCard() {
  const queryClient = useQueryClient();
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(
    null,
  );
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const status = useQuery({
    queryKey: ['two-factor'],
    queryFn: twoFactorApi.status,
  });

  const refresh = async () => {
    setCode('');
    setError(null);
    await queryClient.invalidateQueries({ queryKey: ['two-factor'] });
  };

  const start = useMutation({
    mutationFn: twoFactorApi.setup,
    onSuccess: (data) => {
      setError(null);
      setSetup(data);
    },
    onError: (err) => setError(describeError(err)),
  });

  const enable = useMutation({
    mutationFn: () => twoFactorApi.enable(code),
    onSuccess: async () => {
      setSetup(null);
      await refresh();
    },
    onError: (err) => setError(describeError(err)),
  });

  const disable = useMutation({
    mutationFn: () => twoFactorApi.disable(code),
    onSuccess: refresh,
    onError: (err) => setError(describeError(err)),
  });

  // QR سمت مرورگر ساخته می‌شود؛ کلید هرگز به سرویس بیرونی نمی‌رود.
  const qr = useMemo(
    () => (setup ? renderSVG(setup.otpauthUrl, { border: 2, pixelSize: 5 }) : ''),
    [setup],
  );

  const enabled = status.data?.enabled ?? false;

  return (
    <section className="card">
      <h3>ورود دومرحله‌ای</h3>

      {status.isLoading && <p>در حال بارگذاری…</p>}

      {status.data && enabled && (
        <>
          <p className="hint">
            فعال است: هنگام ورود، علاوه بر رمز، کد شش‌رقمی برنامه‌ی احراز
            هویت گوشی‌تان خواسته می‌شود.
          </p>
          <div className="inline-form">
            <input
              dir="ltr"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              placeholder="کد جاری برای خاموش کردن"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <button
              type="button"
              className="secondary"
              disabled={!code || disable.isPending}
              onClick={() => disable.mutate()}
            >
              خاموش کردن
            </button>
          </div>
        </>
      )}

      {status.data && !enabled && !setup && (
        <>
          <p className="hint">
            با روشن کردن آن، اگر رمز عبورتان لو برود هم کسی بدون گوشی شما وارد
            نمی‌شود. به یک برنامه‌ی احراز هویت (Google Authenticator،
            Microsoft Authenticator، Aegis و…) نیاز دارید.
          </p>
          <button
            type="button"
            disabled={start.isPending}
            onClick={() => start.mutate()}
          >
            راه‌اندازی
          </button>
        </>
      )}

      {setup && !enabled && (
        <div className="publish-body qr-body">
          <div
            className="qr-box"
            /* خروجی uqr یک SVG ساخته‌شده از همین داده است، نه ورودی کاربر. */
            dangerouslySetInnerHTML={{ __html: qr }}
          />
          <div className="qr-side">
            <p className="hint">
              ۱. این کد را با برنامه‌ی احراز هویت اسکن کنید، یا کلید زیر را
              دستی وارد کنید.
            </p>
            <code dir="ltr" className="secret-code">
              {setup.secret.replace(/(.{4})/g, '$1 ').trim()}
            </code>
            <p className="hint">۲. کد شش‌رقمی که برنامه نشان می‌دهد را بنویسید:</p>
            <div className="inline-form">
              <input
                dir="ltr"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={7}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <button
                type="button"
                disabled={!code || enable.isPending}
                onClick={() => enable.mutate()}
              >
                تایید و روشن کردن
              </button>
            </div>
          </div>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      <p className="hint">
        گوشی را گم کرده‌اید؟ مدیر سرور می‌تواند با
        <code dir="ltr"> npm run reset-2fa -- user@example.com </code>
        ورود دومرحله‌ای را خاموش کند.
      </p>
    </section>
  );
}
