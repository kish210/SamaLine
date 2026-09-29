import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { FormScreen } from './FormScreen';
import { offlineOutbox } from './offline-outbox';

/** عدد صحیح از پارامتر نشانی، محدود به یک بازه‌ی امن. */
function numberParam(name: string, fallback: number, min: number, max: number) {
  const raw = Number(new URLSearchParams(window.location.search).get(name));
  if (!Number.isFinite(raw) || raw <= 0) return fallback;
  return Math.min(max, Math.max(min, Math.round(raw)));
}

/**
 * حالت کیوسک: تبلت یا نمایشگر ثابت در لابی، پذیرش یا فروشگاه.
 *
 * نشانی: `/k/<token>` — همان لینک فرم، با پیشوند k به‌جای f.
 *
 * - هر نفر جلسه‌ی مستقل و شناسه‌ی تازه دارد؛ پاسخ نفر قبل هرگز به نفر بعد
 *   نشان داده نمی‌شود.
 * - پس از ثبت، شمارش معکوس (پیش‌فرض ۸ ثانیه، `?reset=`) و بازگشت به ابتدا.
 * - اگر کسی فرم را نیمه‌کاره رها کند، پس از بی‌کاری (پیش‌فرض ۱۲۰ ثانیه،
 *   `?idle=`) فرم پاک و از نو شروع می‌شود.
 * - قطعی شبکه هنگام ثبت: پاسخ روی دستگاه می‌ماند و خودکار ارسال می‌شود؛
 *   تعداد پاسخ‌های در انتظار گوشه‌ی صفحه دیده می‌شود.
 * - دکمه‌ی تمام‌صفحه، و روشن ماندن صفحه (Wake Lock) در مرورگرهایی که دارند.
 *
 * محدودیت: منطق فرم سمت سرور است، پس رفتن بین صفحات به شبکه نیاز دارد؛
 * فقط ثبت نهایی در قطعی ذخیره می‌شود.
 */
export function KioskPage() {
  const { token } = useParams();
  const [round, setRound] = useState(0);
  // فقط فرمی که کسی شروع به پر کردنش کرده و رها شده، پاک می‌شود؛ کیوسکِ
  // دست‌نخورده بی‌دلیل هر دو دقیقه از نو بارگذاری نمی‌شود.
  const [abandonable, setAbandonable] = useState(false);
  const onStateChange = useCallback(
    (state: { view: string; dirty: boolean }) =>
      setAbandonable(state.view === 'form' && state.dirty),
    [],
  );
  const [resetSeconds] = useState(() => numberParam('reset', 8, 3, 120));
  const [idleSeconds] = useState(() => numberParam('idle', 120, 20, 3600));

  const reset = useCallback(() => {
    setRound((prev) => prev + 1);
    setAbandonable(false);
    window.scrollTo(0, 0);
  }, []);

  useIdleReset(abandonable, idleSeconds, reset);
  useWakeLock();

  return (
    <div
      className="kiosk"
      // منوی راست‌کلیک/لمس طولانی در کیوسک فقط راه فرار از فرم است.
      onContextMenu={(event) => event.preventDefault()}
    >
      <KioskToolbar />
      <FormScreen
        // کلید تازه یعنی کل وضعیت فرم (پاسخ‌ها، صفحه، شناسه) از نو ساخته شود.
        key={round}
        token={token}
        kiosk
        onStateChange={onStateChange}
        endSlot={<KioskCountdown seconds={resetSeconds} onDone={reset} />}
      />
    </div>
  );
}

/** شمارش معکوس صفحه‌ی پایان و دکمه‌ی شروع فوری برای نفر بعد. */
function KioskCountdown({
  seconds,
  onDone,
}: {
  seconds: number;
  onDone: () => void;
}) {
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    if (left <= 0) {
      onDone();
      return;
    }
    const timer = setTimeout(() => setLeft((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [left, onDone]);

  return (
    <div className="kiosk-countdown">
      <p>
        فرم تا <strong>{left.toLocaleString('fa-IR')}</strong> ثانیه‌ی دیگر
        برای نفر بعد آماده می‌شود.
      </p>
      <button type="button" onClick={onDone}>
        شروع دوباره
      </button>
    </div>
  );
}

/** نوار کوچک گوشه: تمام‌صفحه و تعداد پاسخ‌های در انتظار ارسال. */
function KioskToolbar() {
  const [fullscreen, setFullscreen] = useState(
    () => typeof document !== 'undefined' && Boolean(document.fullscreenElement),
  );
  const [pending, setPending] = useState(() => offlineOutbox.count());

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setPending(offlineOutbox.count()), 5000);
    return () => clearInterval(timer);
  }, []);

  const canFullscreen =
    typeof document !== 'undefined' &&
    Boolean(document.documentElement.requestFullscreen);

  return (
    <div className="kiosk-toolbar">
      {pending > 0 && (
        <span className="kiosk-pending" title="با برقراری اتصال ارسال می‌شود">
          {pending.toLocaleString('fa-IR')} پاسخ در انتظار ارسال
        </span>
      )}
      {canFullscreen && !fullscreen && (
        <button
          type="button"
          className="kiosk-fullscreen"
          onClick={() =>
            void document.documentElement
              .requestFullscreen()
              .catch(() => undefined)
          }
        >
          تمام‌صفحه
        </button>
      )}
    </div>
  );
}

/**
 * پاک کردن فرم نیمه‌کاره پس از بی‌کاری.
 *
 * هر لمس، کلیک، اسکرول یا کلید زمان را از نو شروع می‌کند.
 */
function useIdleReset(active: boolean, seconds: number, onIdle: () => void) {
  const lastActivity = useRef(0);

  useEffect(() => {
    if (!active) return;
    lastActivity.current = Date.now();
    const touch = () => {
      lastActivity.current = Date.now();
    };
    const events = ['pointerdown', 'keydown', 'touchstart', 'wheel', 'scroll'];
    events.forEach((name) =>
      window.addEventListener(name, touch, { passive: true }),
    );
    const timer = setInterval(() => {
      if (Date.now() - lastActivity.current >= seconds * 1000) onIdle();
    }, 1000);

    return () => {
      events.forEach((name) => window.removeEventListener(name, touch));
      clearInterval(timer);
    };
  }, [active, seconds, onIdle]);
}

interface WakeLockSentinelLike {
  release: () => Promise<void>;
}

/** روشن نگه داشتن صفحه، اگر مرورگر پشتیبانی کند. */
function useWakeLock() {
  useEffect(() => {
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> };
    };
    if (!nav.wakeLock) return;

    let sentinel: WakeLockSentinelLike | null = null;
    const acquire = () => {
      if (document.visibilityState !== 'visible') return;
      nav.wakeLock
        ?.request('screen')
        .then((lock) => {
          sentinel = lock;
        })
        .catch(() => undefined);
    };

    acquire();
    // مرورگر با پنهان شدن صفحه قفل را آزاد می‌کند؛ با برگشت دوباره می‌گیریم.
    document.addEventListener('visibilitychange', acquire);
    return () => {
      document.removeEventListener('visibilitychange', acquire);
      void sentinel?.release().catch(() => undefined);
    };
  }, []);
}
