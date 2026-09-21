import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { describeError, opsApi, type ServiceStatus } from '../api';

type Action = 'start' | 'stop' | 'restart';

/** برچسب و رنگ وضعیت. */
function stateBadge(s: ServiceStatus): { label: string; cls: string } {
  if (s.activeState === 'active') return { label: 'فعال', cls: 'done' };
  if (s.activeState === 'failed') return { label: 'خراب', cls: 'partial' };
  if (s.activeState === 'activating')
    return { label: 'در حال روشن شدن', cls: 'partial' };
  if (s.activeState === 'unknown')
    return { label: 'نامشخص', cls: 'partial' };
  return { label: 'خاموش', cls: 'partial' };
}

function formatMem(bytes: number | null): string {
  if (bytes === null) return '—';
  const mb = bytes / (1024 * 1024);
  return mb >= 1024
    ? `${(mb / 1024).toFixed(1)} گیگ`
    : `${Math.round(mb)} مگ`;
}

function sinceText(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('fa-IR', {
        dateStyle: 'short',
        timeStyle: 'short',
      });
}

/**
 * پایش و کنترل سرویس‌های سامانه — کارت پنل سوپرادمین.
 *
 * برای همان اتفاقی که افتاد ساخته شد: اگر سرویس روی سرور بخوابد یا خراب کار
 * کند، مدیر کل بتواند از همین‌جا وضعیت را ببیند و ری‌استارت/روشن/خاموش کند،
 * بدون SSH.
 *
 * دو هشدار مهم روی «خودِ سرویس» (samaline): ری‌استارتش یعنی قطع کوتاهِ همین
 * پنل (چند ثانیه)، و خاموش کردنش یعنی پنل دیگر بالا نمی‌آید تا دوباره روشنش
 * کند — پس آن دکمه تاییدِ صریح می‌خواهد.
 */
export function ServiceMonitorCard() {
  const queryClient = useQueryClient();
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const services = useQuery({
    queryKey: ['ops-services'],
    queryFn: opsApi.services,
    // وضعیت زنده باشد؛ هر ۱۰ ثانیه تازه شود.
    refetchInterval: 10000,
  });

  const control = useMutation({
    mutationFn: ({ name, action }: { name: string; action: Action }) =>
      opsApi.control(name, action),
    onMutate: ({ name, action }) => {
      setError(null);
      setNote(null);
      setPending(`${name}:${action}`);
    },
    onSuccess: async (res) => {
      setNote(res.message);
      // کمی صبر تا systemd وضعیت را عوض کند، بعد تازه‌سازی.
      setTimeout(() => {
        void queryClient.invalidateQueries({ queryKey: ['ops-services'] });
        setPending(null);
      }, 1500);
    },
    onError: (err, vars) => {
      /*
       * ری‌استارتِ خودِ سرویس، اتصال را وسط کار قطع می‌کند و axios آن را خطا
       * می‌بیند؛ ولی در واقع سرویس دارد بالا می‌آید. برای همین سرویس، این را
       * «در حال ری‌استارت» می‌گیریم نه شکست.
       */
      if (vars.action === 'restart') {
        setNote('دستور ری‌استارت فرستاده شد؛ چند ثانیه صبر کنید…');
        setTimeout(() => {
          void queryClient.invalidateQueries({ queryKey: ['ops-services'] });
          setPending(null);
        }, 4000);
      } else {
        setError(describeError(err));
        setPending(null);
      }
    },
  });

  const act = (name: string, action: Action, isSelf: boolean) => {
    if (action === 'stop') {
      const msg = isSelf
        ? 'خاموش کردن این سرویس، خودِ همین پنل را هم می‌خواباند و دیگر از اینجا نمی‌توانید روشنش کنید (باید از SSH). مطمئنید؟'
        : `سرویس «${name}» خاموش شود؟`;
      if (!window.confirm(msg)) return;
    }
    control.mutate({ name, action });
  };

  if (services.isLoading) {
    return (
      <section className="card">
        <div className="section-head">
          <h3>سرویس‌های سامانه</h3>
        </div>
        <p>در حال بارگذاری…</p>
      </section>
    );
  }

  return (
    <section className="card service-monitor">
      <div className="section-head">
        <h3>سرویس‌های سامانه</h3>
        <button
          type="button"
          className="secondary"
          onClick={() => services.refetch()}
        >
          تازه‌سازی
        </button>
      </div>

      <p className="hint">
        وضعیت زنده‌ی سرویس‌های مربوط به سامانه. اگر چیزی خراب شد، از همین‌جا
        می‌توانید ری‌استارت کنید — بدون نیاز به SSH.
      </p>

      {services.data && !services.data.supported && (
        <p className="empty">
          کنترل سرویس فقط روی سرور لینوکسی در دسترس است (این محیط پشتیبانی
          نمی‌کند).
        </p>
      )}

      {note && <p className="hint success">{note}</p>}
      {error && <p className="error">{error}</p>}

      {services.data?.services.map((s) => {
        const badge = stateBadge(s);
        const busy = (a: Action) => pending === `${s.name}:${a}`;
        const anyBusy = pending?.startsWith(`${s.name}:`) ?? false;
        return (
          <div key={s.name} className="service-row">
            <div className="service-info">
              <span className="service-name">
                {s.description}
                {s.isSelf && <span className="self-tag">خودِ سامانه</span>}
              </span>
              <span className="service-meta">
                <span className={`badge-status ${badge.cls}`}>
                  {badge.label}
                </span>
                <span>حافظه: {formatMem(s.memoryBytes)}</span>
                <span>از: {sinceText(s.since)}</span>
              </span>
            </div>
            <div className="service-actions inline-form">
              <button
                type="button"
                className="secondary"
                disabled={anyBusy}
                onClick={() => act(s.name, 'restart', s.isSelf)}
              >
                {busy('restart') ? '…' : 'ری‌استارت'}
              </button>
              <button
                type="button"
                className="secondary"
                disabled={anyBusy || s.activeState === 'active'}
                onClick={() => act(s.name, 'start', s.isSelf)}
              >
                روشن
              </button>
              <button
                type="button"
                className="danger"
                disabled={anyBusy || s.activeState !== 'active'}
                onClick={() => act(s.name, 'stop', s.isSelf)}
              >
                خاموش
              </button>
            </div>
          </div>
        );
      })}
    </section>
  );
}
