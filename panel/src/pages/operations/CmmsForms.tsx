import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  cmmsApi,
  departmentsApi,
  describeError,
  hrApi,
  roomsApi,
} from '../../api';

/** دسته‌های کارِ فنی، با برچسبِ فارسی. */
export const CATEGORIES: Array<{ value: string; label: string }> = [
  { value: 'electrical', label: 'برق' },
  { value: 'plumbing', label: 'لوله‌کشی' },
  { value: 'hvac', label: 'تهویه و تأسیسات' },
  { value: 'carpentry', label: 'نجاری' },
  { value: 'painting', label: 'نقاشی' },
  { value: 'furniture', label: 'مبلمان' },
  { value: 'network', label: 'شبکه / تلفن / تلویزیون' },
  { value: 'door_lock', label: 'قفل و کارت' },
  { value: 'other', label: 'سایر' },
];

export const PRIORITIES: Array<{ value: string; label: string }> = [
  { value: 'low', label: 'کم' },
  { value: 'normal', label: 'عادی' },
  { value: 'high', label: 'زیاد' },
  { value: 'emergency', label: 'اضطراری' },
];

const CRITICALITIES: Array<{ value: string; label: string }> = [
  { value: 'low', label: 'کم' },
  { value: 'medium', label: 'متوسط' },
  { value: 'high', label: 'زیاد' },
  { value: 'critical', label: 'حیاتی' },
];

/** پوسته‌ی مشترکِ همه‌ی فرم‌های ثبت. */
function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  // بستن با Esc؛ کاربرِ کیبورد نباید در دیالوگ گیر کند.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="section-head">
          <h3>{title}</h3>
          <button type="button" className="link-button" onClick={onClose}>
            بستن
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** داده‌های کمکیِ مشترکِ فرم‌ها (بخش، اتاق، تجهیز، پرسنل). */
function useLookups() {
  const departments = useQuery({
    queryKey: ['departments'],
    queryFn: departmentsApi.list,
  });
  const rooms = useQuery({ queryKey: ['rooms'], queryFn: roomsApi.list });
  const personnel = useQuery({ queryKey: ['personnel'], queryFn: hrApi.list });
  const assets = useQuery({
    queryKey: ['cmms-assets-all'],
    queryFn: () => cmmsApi.assets({ pageSize: 200 }),
  });
  return { departments, rooms, personnel, assets };
}

/** ثبتِ درخواستِ تعمیر. */
export function NewRequestForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { departments, rooms, assets } = useLookups();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'other',
    priority: 'normal',
    departmentId: '',
    roomId: '',
    assetId: '',
    location: '',
    operationalImpact: '',
    dueDate: '',
    guestRelated: false,
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const save = useMutation({
    mutationFn: () =>
      cmmsApi.createRequest({
        ...form,
        // رشته‌ی خالی یعنی «انتخاب نشده»، نه شناسه‌ی تهی.
        departmentId: form.departmentId || null,
        roomId: form.roomId || null,
        assetId: form.assetId || null,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['cmms-dashboard'] });
      await qc.invalidateQueries({ queryKey: ['cmms-records'] });
      onClose();
    },
    onError: (e) => setError(describeError(e)),
  });

  return (
    <Modal title="ثبتِ درخواستِ تعمیر" onClose={onClose}>
      {error && <p className="error">{error}</p>}

      <label>
        عنوانِ مشکل
        <input
          value={form.title}
          placeholder="مثلاً: نشتیِ لولهٔ حمامِ اتاق ۲۰۳"
          onChange={(e) => set('title', e.target.value)}
        />
      </label>

      <label>
        شرحِ مشکل
        <textarea
          rows={3}
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
        />
      </label>

      <div className="grid-2">
        <label>
          دسته
          <select
            value={form.category}
            onChange={(e) => set('category', e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          اولویت
          <select
            value={form.priority}
            onChange={(e) => set('priority', e.target.value)}
          >
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid-2">
        <label>
          بخش
          <select
            value={form.departmentId}
            onChange={(e) => set('departmentId', e.target.value)}
          >
            <option value="">—</option>
            {(departments.data ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          اتاق
          <select
            value={form.roomId}
            onChange={(e) => set('roomId', e.target.value)}
          >
            <option value="">—</option>
            {(rooms.data ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.number}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid-2">
        <label>
          تجهیز
          <select
            value={form.assetId}
            onChange={(e) => set('assetId', e.target.value)}
          >
            <option value="">—</option>
            {(assets.data?.rows ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          محل (اگر اتاق نیست)
          <input
            value={form.location}
            placeholder="مثلاً موتورخانه"
            onChange={(e) => set('location', e.target.value)}
          />
        </label>
      </div>

      <div className="grid-2">
        <label>
          تأثیرِ عملیاتی
          <input
            value={form.operationalImpact}
            placeholder="مثلاً: اتاق غیرقابلِ فروش"
            onChange={(e) => set('operationalImpact', e.target.value)}
          />
        </label>
        <label>
          موعدِ خواسته‌شده
          <input
            type="date"
            value={form.dueDate}
            onChange={(e) => set('dueDate', e.target.value)}
          />
        </label>
      </div>

      <label className="checkbox">
        <input
          type="checkbox"
          checked={form.guestRelated}
          onChange={(e) => set('guestRelated', e.target.checked)}
        />
        مربوط به مهمان است
      </label>

      <div className="inline-form">
        <button
          type="button"
          disabled={!form.title.trim() || save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending ? 'در حال ثبت…' : 'ثبتِ درخواست'}
        </button>
      </div>
    </Modal>
  );
}

/** ثبتِ تجهیز. */
export function NewAssetForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { departments, rooms } = useLookups();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: '',
    name: '',
    category: '',
    manufacturer: '',
    model: '',
    serialNumber: '',
    location: '',
    building: '',
    floor: '',
    roomId: '',
    departmentId: '',
    installedAt: '',
    warrantyUntil: '',
    criticality: 'medium',
  });
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const save = useMutation({
    mutationFn: () =>
      cmmsApi.createAsset({
        ...form,
        roomId: form.roomId || null,
        departmentId: form.departmentId || null,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['cmms-dashboard'] });
      await qc.invalidateQueries({ queryKey: ['cmms-records'] });
      await qc.invalidateQueries({ queryKey: ['cmms-assets-all'] });
      onClose();
    },
    onError: (e) => setError(describeError(e)),
  });

  return (
    <Modal title="ثبتِ تجهیز" onClose={onClose}>
      {error && <p className="error">{error}</p>}

      <div className="grid-2">
        <label>
          کدِ تجهیز
          <input
            value={form.code}
            placeholder="CH-01"
            onChange={(e) => set('code', e.target.value)}
          />
        </label>
        <label>
          نام
          <input
            value={form.name}
            placeholder="چیلرِ مرکزی"
            onChange={(e) => set('name', e.target.value)}
          />
        </label>
      </div>

      <div className="grid-2">
        <label>
          دسته
          <input
            value={form.category}
            placeholder="HVAC"
            onChange={(e) => set('category', e.target.value)}
          />
        </label>
        <label>
          اهمیت
          <select
            value={form.criticality}
            onChange={(e) => set('criticality', e.target.value)}
          >
            {CRITICALITIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid-2">
        <label>
          سازنده
          <input
            value={form.manufacturer}
            onChange={(e) => set('manufacturer', e.target.value)}
          />
        </label>
        <label>
          مدل
          <input
            value={form.model}
            onChange={(e) => set('model', e.target.value)}
          />
        </label>
      </div>

      <div className="grid-2">
        <label>
          شماره سریال
          <input
            value={form.serialNumber}
            onChange={(e) => set('serialNumber', e.target.value)}
          />
        </label>
        <label>
          محل
          <input
            value={form.location}
            placeholder="موتورخانه"
            onChange={(e) => set('location', e.target.value)}
          />
        </label>
      </div>

      <div className="grid-2">
        <label>
          ساختمان
          <input
            value={form.building}
            onChange={(e) => set('building', e.target.value)}
          />
        </label>
        <label>
          طبقه
          <input
            value={form.floor}
            onChange={(e) => set('floor', e.target.value)}
          />
        </label>
      </div>

      <div className="grid-2">
        <label>
          اتاق
          <select
            value={form.roomId}
            onChange={(e) => set('roomId', e.target.value)}
          >
            <option value="">—</option>
            {(rooms.data ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.number}
              </option>
            ))}
          </select>
        </label>
        <label>
          بخشِ مسئول
          <select
            value={form.departmentId}
            onChange={(e) => set('departmentId', e.target.value)}
          >
            <option value="">—</option>
            {(departments.data ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid-2">
        <label>
          تاریخِ نصب
          <input
            type="date"
            value={form.installedAt}
            onChange={(e) => set('installedAt', e.target.value)}
          />
        </label>
        <label>
          پایانِ گارانتی
          <input
            type="date"
            value={form.warrantyUntil}
            onChange={(e) => set('warrantyUntil', e.target.value)}
          />
        </label>
      </div>

      <div className="inline-form">
        <button
          type="button"
          disabled={!form.code.trim() || !form.name.trim() || save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending ? 'در حال ثبت…' : 'ثبتِ تجهیز'}
        </button>
      </div>
    </Modal>
  );
}

/** ثبتِ دستورِ کار (مستقل یا از روی یک درخواست). */
export function NewWorkOrderForm({
  onClose,
  fromRequestId,
  defaults,
}: {
  onClose: () => void;
  fromRequestId?: string;
  defaults?: { title?: string; category?: string; priority?: string };
}) {
  const qc = useQueryClient();
  const { departments, rooms, personnel, assets } = useLookups();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: defaults?.title ?? '',
    category: defaults?.category ?? 'other',
    priority: defaults?.priority ?? 'normal',
    departmentId: '',
    roomId: '',
    assetId: '',
    workDescription: '',
    dueDate: '',
  });
  const [techs, setTechs] = useState<string[]>([]);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((p) => ({ ...p, [k]: v }));

  const toggleTech = (id: string) =>
    setTechs((p) => (p.includes(id) ? p.filter((t) => t !== id) : [...p, id]));

  const save = useMutation({
    mutationFn: () =>
      cmmsApi.createWorkOrder({
        ...form,
        departmentId: form.departmentId || null,
        roomId: form.roomId || null,
        assetId: form.assetId || null,
        requestId: fromRequestId ?? null,
        technicianIds: techs,
      }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['cmms-dashboard'] });
      await qc.invalidateQueries({ queryKey: ['cmms-records'] });
      onClose();
    },
    onError: (e) => setError(describeError(e)),
  });

  return (
    <Modal
      title={fromRequestId ? 'دستورِ کار از این درخواست' : 'ثبتِ دستورِ کار'}
      onClose={onClose}
    >
      {error && <p className="error">{error}</p>}

      <label>
        عنوانِ کار
        <input
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
        />
      </label>

      <label>
        شرحِ کارِ لازم
        <textarea
          rows={3}
          value={form.workDescription}
          onChange={(e) => set('workDescription', e.target.value)}
        />
      </label>

      <div className="grid-2">
        <label>
          دسته
          <select
            value={form.category}
            onChange={(e) => set('category', e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          اولویت
          <select
            value={form.priority}
            onChange={(e) => set('priority', e.target.value)}
          >
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid-2">
        <label>
          تجهیز
          <select
            value={form.assetId}
            onChange={(e) => set('assetId', e.target.value)}
          >
            <option value="">—</option>
            {(assets.data?.rows ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          اتاق
          <select
            value={form.roomId}
            onChange={(e) => set('roomId', e.target.value)}
          >
            <option value="">—</option>
            {(rooms.data ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.number}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid-2">
        <label>
          بخش
          <select
            value={form.departmentId}
            onChange={(e) => set('departmentId', e.target.value)}
          >
            <option value="">—</option>
            {(departments.data ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          موعدِ انجام
          <input
            type="date"
            value={form.dueDate}
            onChange={(e) => set('dueDate', e.target.value)}
          />
        </label>
      </div>

      <fieldset>
        <legend>تکنسین‌ها (اولی نفرِ اصلی)</legend>
        {(personnel.data ?? []).length === 0 ? (
          <p className="hint">
            پرسنلی ثبت نشده است؛ از بخشِ «پرسنل» اضافه کنید.
          </p>
        ) : (
          (personnel.data ?? []).map((p) => (
            <label key={p.id} className="checkbox">
              <input
                type="checkbox"
                checked={techs.includes(p.id)}
                onChange={() => toggleTech(p.id)}
              />
              {p.fullName}
              {p.position ? ` — ${p.position}` : ''}
            </label>
          ))
        )}
      </fieldset>

      <p className="hint">
        با انتخابِ تکنسین، دستورِ کار «ارجاع‌شده» ثبت می‌شود؛ بدونِ تکنسین
        «بی‌متصدی» می‌ماند.
      </p>

      <div className="inline-form">
        <button
          type="button"
          disabled={!form.title.trim() || save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending ? 'در حال ثبت…' : 'ثبتِ دستورِ کار'}
        </button>
      </div>
    </Modal>
  );
}

export { Modal };
