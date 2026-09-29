import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { authApi, describeError } from '../api';
import { useAuth } from '../auth';

type Mode = 'login' | 'register';

export function LoginPage() {
  const signIn = useAuth((s) => s.signIn);
  const [mode, setMode] = useState<Mode>('login');
  const [error, setError] = useState<string | null>(null);
  // حساب با ورود دومرحله‌ای: پس از رمز درست، کد برنامه‌ی احراز هویت.
  const [needsCode, setNeedsCode] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    organizationName: '',
    workspaceName: 'فضای کاری اصلی',
  });

  const set = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const mutation = useMutation({
    mutationFn: () =>
      mode === 'login'
        ? authApi.login({
            email: form.email,
            password: form.password,
            totpCode: needsCode ? totpCode : undefined,
          })
        : authApi.register(form),
    onSuccess: (data) => {
      if ('twoFactorRequired' in data) {
        setNeedsCode(true);
        return;
      }
      signIn(data);
    },
    onError: (err) => setError(describeError(err)),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    mutation.mutate();
  };

  return (
    <div className="auth-page">
      <form className="card auth-card" onSubmit={submit}>
        <div className="auth-brand">
          <span className="brand-mark" aria-hidden="true">
            س
          </span>
          <h1>سماء‌لاین</h1>
          <p>سامانه‌ی نظرسنجی، فرم‌ساز و گزارش‌گیری</p>
        </div>

        <div className="tabs">
          <button
            type="button"
            className={mode === 'login' ? 'active' : ''}
            onClick={() => {
              setMode('login');
              setNeedsCode(false);
            }}
          >
            ورود
          </button>
          <button
            type="button"
            className={mode === 'register' ? 'active' : ''}
            onClick={() => {
              setMode('register');
              setNeedsCode(false);
            }}
          >
            ثبت‌نام
          </button>
        </div>

        {mode === 'register' && (
          <>
            <label>
              نام و نام خانوادگی
              <input
                required
                value={form.fullName}
                onChange={(e) => set('fullName', e.target.value)}
              />
            </label>
            <label>
              نام سازمان
              <input
                required
                value={form.organizationName}
                onChange={(e) => set('organizationName', e.target.value)}
              />
            </label>
            <label>
              نام فضای کاری
              <input
                required
                value={form.workspaceName}
                onChange={(e) => set('workspaceName', e.target.value)}
              />
            </label>
          </>
        )}

        <label>
          ایمیل
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
          />
        </label>

        <label>
          رمز عبور
          <input
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
          />
        </label>

        {needsCode && mode === 'login' && (
          <label>
            کد ورود دومرحله‌ای
            <input
              required
              autoFocus
              dir="ltr"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={7}
              placeholder="۶ رقم از برنامه‌ی احراز هویت"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
            />
          </label>
        )}

        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={mutation.isPending}>
          {mutation.isPending
            ? 'در حال ارسال…'
            : mode === 'login'
              ? 'ورود'
              : 'ساخت حساب'}
        </button>
      </form>
    </div>
  );
}
