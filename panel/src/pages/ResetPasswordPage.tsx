import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { authApi, describeError } from '../api';

/**
 * تعیین رمز تازه از لینک ایمیل بازیابی (`/panel/reset-password?token=…`).
 *
 * بیرون از ورود در دسترس است؛ توکن یک‌بارمصرف و ۳۰ دقیقه‌ای است.
 */
export function ResetPasswordPage() {
  const [token] = useState(
    () => new URLSearchParams(window.location.search).get('token') ?? '',
  );
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reset = useMutation({
    mutationFn: () => authApi.resetPassword(token, password),
    onError: (err) => setError(describeError(err)),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 8) {
      setError('رمز تازه باید دست‌کم ۸ نویسه باشد');
      return;
    }
    if (password !== repeat) {
      setError('تکرار رمز با خودش یکی نیست');
      return;
    }
    setError(null);
    reset.mutate();
  };

  const loginHref = `${import.meta.env.BASE_URL}`;

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <div className="auth-brand">
          <span className="brand-mark" aria-hidden="true">
            س
          </span>
          <h1>تعیین رمز تازه</h1>
        </div>

        {!token && (
          <p className="error">
            لینک ناقص است. لینک کامل ایمیل را باز کنید یا دوباره «فراموشی رمز» را
            بزنید.
          </p>
        )}

        {reset.isSuccess ? (
          <>
            <p className="hint success">
              رمز تازه ثبت شد. حالا می‌توانید با آن وارد شوید.
            </p>
            <a className="button-like" href={loginHref}>
              ورود به پنل
            </a>
          </>
        ) : (
          token && (
            <form onSubmit={submit}>
              <label>
                رمز تازه (دست‌کم ۸ نویسه)
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <label>
                تکرار رمز تازه
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  value={repeat}
                  onChange={(e) => setRepeat(e.target.value)}
                />
              </label>
              {error && <p className="error">{error}</p>}
              <button type="submit" disabled={reset.isPending}>
                {reset.isPending ? 'در حال ذخیره…' : 'ثبت رمز تازه'}
              </button>
            </form>
          )
        )}
      </div>
    </div>
  );
}
