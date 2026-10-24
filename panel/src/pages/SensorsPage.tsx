import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  describeError,
  sensorsApi,
  workspaceApi,
  type ColdRoomSensor,
  type SensorConnectorKind,
  type SensorHealth,
} from '../api';
import { isoToJalaliText } from '../jalali';

const HEALTH_LABELS: Record<SensorHealth, string> = {
  ok: 'عادی',
  low: 'زیر حد',
  high: 'بالای حد',
  stale: 'کهنه/آفلاین',
  unknown: 'نامشخص',
};
const CONNECTOR_LABELS: Record<SensorConnectorKind, string> = {
  manual: 'ثبت دستی',
  http: 'HTTP',
  simulated: 'شبیه‌ساز (آزمایشی)',
};
const CONNECTORS = Object.keys(CONNECTOR_LABELS) as SensorConnectorKind[];

/** پایش دمای سردخانه‌های هتل: سنسورها، قرائت‌ها و هشدارها. */
export function SensorsPage() {
  const queryClient = useQueryClient();
  const workspaces = useQuery({ queryKey: ['workspaces'], queryFn: workspaceApi.list });
  const workspaceId = workspaces.data?.[0]?.id ?? '';

  const sensors = useQuery({
    queryKey: ['sensors', workspaceId],
    queryFn: () => sensorsApi.list(workspaceId),
    enabled: Boolean(workspaceId),
    refetchInterval: 60000,
  });
  const alerts = useQuery({
    queryKey: ['sensor-alerts', workspaceId],
    queryFn: () => sensorsApi.alerts(workspaceId),
    enabled: Boolean(workspaceId),
    refetchInterval: 60000,
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['sensors'] });
    void queryClient.invalidateQueries({ queryKey: ['sensor-alerts'] });
  };

  const ack = useMutation({
    mutationFn: (alertId: string) => sensorsApi.ackAlert(workspaceId, alertId),
    onSuccess: refresh,
  });

  if (!workspaceId) return <div className="page">در حال بارگذاری…</div>;

  return (
    <div className="page">
      <header className="page-header">
        <h1>پایش دمای سردخانه</h1>
      </header>

      {alerts.data && alerts.data.length > 0 && (
        <section className="card alert-card">
          <h3>هشدارهای باز ({alerts.data.length})</h3>
          <table className="simple-table">
            <tbody>
              {alerts.data.map((a) => (
                <tr key={a.id}>
                  <td>{HEALTH_LABELS[a.kind] ?? a.kind}</td>
                  <td>{a.message}</td>
                  <td>{isoToJalaliText(a.createdAt)}</td>
                  <td>
                    <button type="button" className="link-button" disabled={ack.isPending} onClick={() => ack.mutate(a.id)}>
                      رسیدگی شد
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <AddSensor workspaceId={workspaceId} onAdded={refresh} />

      <section className="card">
        <h3>سنسورها</h3>
        {sensors.isLoading ? <p>در حال بارگذاری…</p> : sensors.isError ? (
          <p className="error">{describeError(sensors.error)}</p>
        ) : (
          <table className="simple-table">
            <thead>
              <tr><th>نام</th><th>محل</th><th>دمای فعلی</th><th>وضعیت</th><th>اتصال</th><th>آخرین قرائت</th><th></th></tr>
            </thead>
            <tbody>
              {(sensors.data ?? []).map((s) => (
                <SensorRow key={s.id} workspaceId={workspaceId} sensor={s} onChanged={refresh} />
              ))}
              {(sensors.data ?? []).length === 0 && <tr><td colSpan={7} className="hint">سنسوری تعریف نشده.</td></tr>}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function AddSensor({ workspaceId, onAdded }: { workspaceId: string; onAdded: () => void }) {
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [connector, setConnector] = useState<SensorConnectorKind>('simulated');
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [message, setMessage] = useState('');

  const create = useMutation({
    mutationFn: () =>
      sensorsApi.create(workspaceId, {
        name,
        location,
        connector,
        minThreshold: min === '' ? null : Number(min),
        maxThreshold: max === '' ? null : Number(max),
      }),
    onSuccess: () => { setName(''); setLocation(''); setMin(''); setMax(''); setMessage('سنسور افزوده شد.'); onAdded(); },
    onError: (e) => setMessage(describeError(e)),
  });

  return (
    <section className="card">
      <h3>افزودن سنسور</h3>
      {message && <p className="hint">{message}</p>}
      <div className="inline-form">
        <input placeholder="نام سنسور" value={name} onChange={(e) => setName(e.target.value)} />
        <input placeholder="محل (سردخانه)" value={location} onChange={(e) => setLocation(e.target.value)} />
        <label className="inline-select"><span>اتصال</span>
          <select value={connector} onChange={(e) => setConnector(e.target.value as SensorConnectorKind)}>
            {CONNECTORS.map((c) => <option key={c} value={c}>{CONNECTOR_LABELS[c]}</option>)}
          </select>
        </label>
        <input type="number" placeholder="حد پایین°" value={min} onChange={(e) => setMin(e.target.value)} style={{ width: 90 }} />
        <input type="number" placeholder="حد بالا°" value={max} onChange={(e) => setMax(e.target.value)} style={{ width: 90 }} />
        <button type="button" disabled={create.isPending || !name.trim()} onClick={() => create.mutate()}>افزودن</button>
      </div>
      {connector === 'http' && (
        <p className="hint">برای اتصال HTTP، پس از ساخت، نشانی و توکن سنسور را در تنظیمات آن وارد کنید. شبیه‌ساز فقط داده‌ی آزمایشی می‌دهد.</p>
      )}
    </section>
  );
}

function SensorRow({ workspaceId, sensor, onChanged }: { workspaceId: string; sensor: ColdRoomSensor; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');

  const submit = useMutation({
    mutationFn: () => sensorsApi.submitReading(workspaceId, sensor.id, Number(value)),
    onSuccess: () => { setValue(''); onChanged(); },
  });
  const remove = useMutation({
    mutationFn: () => sensorsApi.remove(workspaceId, sensor.id),
    onSuccess: onChanged,
  });
  const readings = useQuery({
    queryKey: ['sensor-readings', sensor.id],
    queryFn: () => sensorsApi.readings(workspaceId, sensor.id, 20),
    enabled: open,
  });

  return (
    <>
      <tr>
        <td>{sensor.name}</td>
        <td>{sensor.location || '—'}</td>
        <td>{sensor.lastValue === null ? '—' : `${sensor.lastValue}°${sensor.unit}`}</td>
        <td><span className={`badge health-${sensor.lastHealth}`}>{HEALTH_LABELS[sensor.lastHealth]}</span></td>
        <td>{CONNECTOR_LABELS[sensor.connector]}</td>
        <td>{sensor.lastReadingAt ? isoToJalaliText(sensor.lastReadingAt) : '—'}</td>
        <td>
          <button type="button" className="link-button" onClick={() => setOpen((o) => !o)}>{open ? 'بستن' : 'جزئیات'}</button>
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={7}>
            <div className="inline-form">
              <input type="number" placeholder="ثبت دستی دما°" value={value} onChange={(e) => setValue(e.target.value)} style={{ width: 130 }} />
              <button type="button" disabled={submit.isPending || value === ''} onClick={() => submit.mutate()}>ثبت قرائت</button>
              <button type="button" className="danger" onClick={() => { if (window.confirm('این سنسور حذف شود؟')) remove.mutate(); }}>حذف سنسور</button>
            </div>
            <p className="hint">
              حد مجاز: {sensor.minThreshold ?? '—'} تا {sensor.maxThreshold ?? '—'} · کهنگی پس از {sensor.staleAfterSeconds} ثانیه
            </p>
            <table className="simple-table">
              <thead><tr><th>دما</th><th>زمان</th><th>منبع</th></tr></thead>
              <tbody>
                {(readings.data ?? []).map((r) => (
                  <tr key={r.id}>
                    <td>{r.value}°{r.unit}</td>
                    <td>{isoToJalaliText(r.observedAt)}</td>
                    <td>{r.isSimulated ? 'آزمایشی' : 'واقعی'}</td>
                  </tr>
                ))}
                {open && (readings.data ?? []).length === 0 && <tr><td colSpan={3} className="hint">قرائتی نیست.</td></tr>}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}
