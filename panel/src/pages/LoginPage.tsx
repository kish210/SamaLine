import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { authApi, describeError, platformApi } from '../api';
import { useAuth } from '../auth';

type Mode = 'login' | 'register' | 'forgot';

export function LoginPage() {
  const signIn = useAuth((s) => s.signIn);
  const [mode, setMode] = useState<Mode>('login');
  const [error, setError] = useState<string | null>(null);
  // حساب با ورود دومرحله‌ای: پس از رمز درست، کد برنامه‌ی احراز هویت.
  const [needsCode, setNeedsCode] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  // اگر سوپرادمین ثبت‌نام را بسته باشد، زبانه‌ی ثبت‌نام نمایش داده نمی‌شود.
  const publicConfig = useQuery({
    queryKey: ['public-config'],
    queryFn: platformApi.publicConfig,
    retry: false,
  });
  const registrationEnabled = publicConfig.data?.registrationEnabled ?? true;

  // اگر ثبت‌نام بسته شد در حالی که روی زبانه‌ی ثبت‌نام بودیم, به ورود برگرد.
  useEffect(() => {
    if (!registrationEnabled && mode === 'register') setMode('login');
  }, [registrationEnabled, mode]);
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

  const forgot = useMutation({
    mutationFn: () => authApi.forgotPassword(form.email),
    onSuccess: (data) => setNotice(data.message),
    onError: (err) => setError(describeError(err)),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (mode === 'forgot') {
      forgot.mutate();
      return;
    }
    mutation.mutate();
  };

  const pending = mutation.isPending || forgot.isPending;

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
            className={mode !== 'register' ? 'active' : ''}
            onClick={() => {
              setMode('login');
              setNeedsCode(false);
              setNotice(null);
            }}
          >
            ورود
          </button>
          {registrationEnabled && (
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
          )}
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

        {mode === 'forgot' ? (
          <p className="hint">
            ایمیل حسابتان را بنویسید؛ لینک تعیین رمز تازه برایتان فرستاده
            می‌شود.
          </p>
        ) : (
          <label>
            رمز عبور
            <input
              type="password"
              required
              minLength={mode === 'register' ? 8 : undefined}
              autoComplete={
                mode === 'register' ? 'new-password' : 'current-password'
              }
              value={form.password}
              onChange={(e) => set('password', e.target.value)}
            />
          </label>
        )}

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
        {notice && <p className="hint success">{notice}</p>}

        <button type="submit" disabled={pending}>
          {pending
            ? 'در حال ارسال…'
            : mode === 'login'
              ? 'ورود'
              : mode === 'forgot'
                ? 'ارسال لینک بازیابی'
                : 'ساخت حساب'}
        </button>

        {mode === 'login' && (
          <button
            type="button"
            className="link-button auth-switch"
            onClick={() => {
              setMode('forgot');
              setNeedsCode(false);
              setError(null);
            }}
          >
            رمز را فراموش کرده‌اید؟
          </button>
        )}
        {mode === 'forgot' && (
          <button
            type="button"
            className="link-button auth-switch"
            onClick={() => {
              setMode('login');
              setNotice(null);
              setError(null);
            }}
          >
            بازگشت به ورود
          </button>
        )}
      </form>
    </div>
  );
}
