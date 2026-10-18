import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { authApi, describeError, platformApi } from '../api';
import { useAuth } from '../auth';

type Mode = 'login' | 'register';

export function LoginPage() {
  const signIn = useAuth((s) => s.signIn);
  const [mode, setMode] = useState<Mode>('login');
  const [error, setError] = useState<string | null>(null);

  // اگر سوپرادمین ثبت‌نام را بسته باشد، زبانه‌ی ثبت‌نام نمایش داده نمی‌شود.
  const publicConfig = useQuery({
    queryKey: ['public-config'],
    queryFn: platformApi.publicConfig,
    retry: false,
  });
  const registrationEnabled = publicConfig.data?.registrationEnabled ?? true;

  // اگر ثبت‌نام بسته شد در حالی که روی زبانه‌ی ثبت‌نام بودیم، به ورود برگرد.
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
        ? authApi.login({ email: form.email, password: form.password })
        : authApi.register(form),
    onSuccess: signIn,
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
        <h1>سامانه نظرسنجی سماء‌لاین</h1>

        <div className="tabs">
          <button
            type="button"
            className={mode === 'login' ? 'active' : ''}
            onClick={() => setMode('login')}
          >
            ورود
          </button>
          {registrationEnabled && (
            <button
              type="button"
              className={mode === 'register' ? 'active' : ''}
              onClick={() => setMode('register')}
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
