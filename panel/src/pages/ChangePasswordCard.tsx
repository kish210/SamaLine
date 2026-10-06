import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { authApi, describeError } from '../api';
import { useAuth } from '../auth';

/**
 * تغییر رمز عبور.
 *
 * پس از تغییر، همه‌ی نشست‌های دیگر (دستگاه‌های دیگر) باطل می‌شوند و همین
 * دستگاه با نشست تازه‌ای که سرور برمی‌گرداند وارد می‌ماند.
 */
export function ChangePasswordCard() {
  const signIn = useAuth((s) => s.signIn);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const change = useMutation({
    mutationFn: () => authApi.changePassword(current, next),
    onSuccess: (session) => {
      signIn(session);
      setCurrent('');
      setNext('');
      setRepeat('');
      setError(null);
      setDone(true);
    },
    onError: (err) => setError(describeError(err)),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setDone(false);
    if (next.length < 8) {
      setError('رمز تازه باید دست‌کم ۸ نویسه باشد');
      return;
    }
    if (next !== repeat) {
      setError('تکرار رمز تازه با خودش یکی نیست');
      return;
    }
    change.mutate();
  };

  return (
    <section className="card">
      <h3>تغییر رمز عبور</h3>
      <form className="stack-form" onSubmit={submit}>
        <label>
          رمز فعلی
          <input
            type="password"
            autoComplete="current-password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </label>
        <label>
          رمز تازه (دست‌کم ۸ نویسه)
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={next}
            onChange={(e) => setNext(e.target.value)}
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
        {done && (
          <p className="hint success">
            رمز عوض شد. اگر روی دستگاه دیگری وارد بودید، آنجا باید دوباره وارد شوید.
          </p>
        )}
        <button type="submit" disabled={change.isPending}>
          {change.isPending ? 'در حال ذخیره…' : 'تغییر رمز'}
        </button>
      </form>
    </section>
  );
}
