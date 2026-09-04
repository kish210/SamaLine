import { useEffect, useRef, useState } from 'react';

interface FieldProps {
  value: unknown;
  onChange: (value: unknown) => void;
}

const asText = (value: unknown) => (value == null ? '' : String(value));

/** حداکثر حجم فایل پیوست؛ بزرگ‌تر از این در پاسخ جا نمی‌شود. */
const MAX_FILE_BYTES = 3 * 1024 * 1024;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('خواندن فایل ناموفق بود'));
    reader.readAsDataURL(file);
  });
}

/**
 * پیوست فایل.
 *
 * فایل به‌صورت data URL در خود پاسخ ذخیره می‌شود تا نیازی به سرویس
 * ذخیره‌سازی جدا نباشد (شرط خوداتکا بودن پروژه)؛ به همین دلیل سقف حجم
 * سخت‌گیرانه است.
 */
export function FileField({
  value,
  onChange,
  capture,
  accept,
  label,
}: FieldProps & {
  capture?: boolean;
  accept: string;
  label: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const current = asText(value);
  const isImage = current.startsWith('data:image/');

  const pick = async (file: File) => {
    if (file.size > MAX_FILE_BYTES) {
      setError('حجم فایل نباید از ۳ مگابایت بیشتر باشد.');
      return;
    }
    try {
      onChange(await readAsDataUrl(file));
      setError(null);
    } catch {
      setError('خواندن فایل ناموفق بود.');
    }
  };

  return (
    <div className="media-field">
      {isImage && <img className="media-preview" src={current} alt="" />}
      {current && !isImage && <p className="hint">فایل انتخاب شد.</p>}

      <div className="media-actions">
        <label className="media-button">
          {current ? 'تغییر فایل' : label}
          <input
            type="file"
            accept={accept}
            // در موبایل، مستقیم دوربین باز می‌شود.
            {...(capture ? { capture: 'environment' as const } : {})}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void pick(file);
            }}
          />
        </label>

        {current && (
          <button type="button" className="secondary" onClick={() => onChange('')}>
            حذف
          </button>
        )}
      </div>

      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

/**
 * امضای دستی روی بوم.
 *
 * خروجی یک تصویر PNG به‌صورت data URL است تا مثل بقیه‌ی پاسخ‌ها ذخیره و
 * در گزارش دیده شود.
 */
export function SignatureField({ value, onChange }: FieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const current = asText(value);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    // بوم با نسبت پیکسل دستگاه تنظیم می‌شود تا خط تار نشود.
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    context.scale(ratio, ratio);
    context.lineWidth = 2;
    context.lineCap = 'round';
    context.strokeStyle = '#111827';
  }, []);

  const pointOf = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const context = canvasRef.current?.getContext('2d');
    if (!context) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    const { x, y } = pointOf(event);
    context.beginPath();
    context.moveTo(x, y);
  };

  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const context = canvasRef.current?.getContext('2d');
    if (!context) return;
    const { x, y } = pointOf(event);
    context.lineTo(x, y);
    context.stroke();
  };

  const end = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = canvasRef.current;
    if (canvas) onChange(canvas.toDataURL('image/png'));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (canvas && context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
    }
    onChange('');
  };

  return (
    <div className="signature-field">
      <canvas
        ref={canvasRef}
        className="signature-canvas"
        // لمس نباید صفحه را اسکرول کند وقتی کاربر دارد امضا می‌کند.
        style={{ touchAction: 'none' }}
        onPointerDown={start}
        onPointerMove={draw}
        onPointerUp={end}
        onPointerLeave={end}
      />
      <div className="media-actions">
        <button type="button" className="secondary" onClick={clear}>
          پاک کردن
        </button>
        {current && <span className="hint">امضا ثبت شد</span>}
      </div>
    </div>
  );
}

/** موقعیت مکانی: از GPS دستگاه یا ورود دستی. */
export function LocationField({ value, onChange }: FieldProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = asText(value);

  const locate = () => {
    if (!navigator.geolocation) {
      setError('مرورگر شما موقعیت مکانی را پشتیبانی نمی‌کند.');
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        onChange(`${latitude.toFixed(6)},${longitude.toFixed(6)}`);
        setError(null);
        setBusy(false);
      },
      () => {
        setError('دسترسی به موقعیت مکانی داده نشد.');
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="media-field">
      <div className="media-actions">
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={locate}
        >
          {busy ? 'در حال یافتن…' : 'ثبت موقعیت فعلی'}
        </button>
      </div>

      <input
        dir="ltr"
        placeholder="عرض و طول جغرافیایی، مثل 26.5,53.9"
        value={current}
        onChange={(event) => onChange(event.target.value)}
      />

      {current.includes(',') && (
        <a
          className="hint"
          href={`https://www.google.com/maps?q=${encodeURIComponent(current)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          دیدن روی نقشه
        </a>
      )}

      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

/** ضبط صدا با میکروفن دستگاه. */
export function AudioField({ value, onChange }: FieldProps) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = asText(value);

  // با ترک صفحه، میکروفن نباید باز بماند.
  useEffect(
    () => () => {
      recorderRef.current?.stream.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (event) => chunksRef.current.push(event.data);
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        const reader = new FileReader();
        reader.onload = () => onChange(String(reader.result));
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setError(null);
    } catch {
      setError('دسترسی به میکروفن داده نشد.');
    }
  };

  const stop = () => {
    recorderRef.current?.stop();
    setRecording(false);
  };

  return (
    <div className="media-field">
      <div className="media-actions">
        <button
          type="button"
          className={recording ? 'danger' : 'secondary'}
          onClick={recording ? stop : () => void start()}
        >
          {recording ? '■ توقف ضبط' : '● شروع ضبط'}
        </button>
        {current && (
          <button type="button" className="secondary" onClick={() => onChange('')}>
            حذف
          </button>
        )}
      </div>

      {current && <audio className="audio-preview" controls src={current} />}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
