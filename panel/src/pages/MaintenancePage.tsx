import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  describeError,
  maintenanceApi,
  workspaceApi,
  type MaintenanceCategory,
  type MaintenancePriority,
  type MaintenanceRequest,
  type MaintenanceStatus,
  type RoomReadinessStatus,
} from '../api';
import { isoToJalaliText } from '../jalali';

const CATEGORY_LABELS: Record<MaintenanceCategory, string> = {
  electrical: 'برق',
  plumbing: 'لوله‌کشی',
  hvac: 'تهویه و سرمایش/گرمایش',
  carpentry: 'نجاری',
  painting: 'نقاشی',
  furniture: 'مبلمان',
  network_phone_tv: 'شبکه/تلفن/تلویزیون',
  locks_access: 'قفل و کارت دسترسی',
  other: 'سایر',
};
const PRIORITY_LABELS: Record<MaintenancePriority, string> = {
  normal: 'عادی',
  urgent: 'فوری',
  emergency: 'اضطراری',
};
const STATUS_LABELS: Record<MaintenanceStatus, string> = {
  new: 'جدید',
  in_progress: 'در حال انجام',
  waiting_part: 'منتظر قطعه',
  contractor_required: 'نیازمند پیمانکار',
  follow_up: 'نیازمند پیگیری',
  done: 'انجام‌شده',
  cancelled: 'لغو شده',
};
const READINESS_LABELS: Record<RoomReadinessStatus, string> = {
  ready: 'آماده',
  needs_inspection: 'نیازمند بازبینی',
  not_ready: 'آماده نیست',
};

const CATEGORIES = Object.keys(CATEGORY_LABELS) as MaintenanceCategory[];
const PRIORITIES = Object.keys(PRIORITY_LABELS) as MaintenancePriority[];
const STATUSES = Object.keys(STATUS_LABELS) as MaintenanceStatus[];
const READINESS = Object.keys(READINESS_LABELS) as RoomReadinessStatus[];

/** بخش فنی و نگهداری هتل: داشبورد، درخواست‌ها و آماده‌بودن اتاق. */
export function MaintenancePage() {
  const queryClient = useQueryClient();
  const workspaces = useQuery({ queryKey: ['workspaces'], queryFn: workspaceApi.list });
  const workspaceId = workspaces.data?.[0]?.id ?? '';

  const [tab, setTab] = useState<'dashboard' | 'requests' | 'rooms'>('dashboard');

  if (!workspaceId) return <div className="page">در حال بارگذاری…</div>;

  return (
    <div className="page">
      <header className="page-header">
        <h1>نگهداری و تعمیرات</h1>
        <div className="tabs">
          <button type="button" className={tab === 'dashboard' ? 'active' : ''} onClick={() => setTab('dashboard')}>داشبورد</button>
          <button type="button" className={tab === 'requests' ? 'active' : ''} onClick={() => setTab('requests')}>درخواست‌ها</button>
          <button type="button" className={tab === 'rooms' ? 'active' : ''} onClick={() => setTab('rooms')}>آماده‌بودن اتاق</button>
        </div>
      </header>

      {tab === 'dashboard' && <Dashboard workspaceId={workspaceId} />}
      {tab === 'requests' && <Requests workspaceId={workspaceId} queryClient={queryClient} />}
      {tab === 'rooms' && <Rooms workspaceId={workspaceId} queryClient={queryClient} />}
    </div>
  );
}

function Dashboard({ workspaceId }: { workspaceId: string }) {
  const d = useQuery({
    queryKey: ['maint-dashboard', workspaceId],
    queryFn: () => maintenanceApi.dashboard(workspaceId),
  });
  if (d.isLoading) return <p>در حال بارگذاری…</p>;
  if (d.isError) return <p className="error">{describeError(d.error)}</p>;
  const t = d.data!.totals;

  const tiles: Array<[string, number]> = [
    ['کل درخواست‌های باز', t.open],
    ['واگذارنشده', t.unassigned],
    ['فوری/اضطراری', t.urgent],
    ['منتظر قطعه', t.waitingPart],
    ['نیازمند پیمانکار', t.contractor],
    ['نیازمند پیگیری', t.followUp],
    ['انجام‌شده', t.done],
    ['کل (بایگانی‌نشده)', t.total],
  ];

  return (
    <>
      <section className="stat-grid">
        {tiles.map(([label, value]) => (
          <div className="stat-tile" key={label}>
            <div className="stat-value">{value.toLocaleString('fa-IR')}</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </section>

      <div className="grid-2">
        <GroupCard title="بر اساس دسته" rows={d.data!.byCategory} label={(k) => CATEGORY_LABELS[k as MaintenanceCategory] ?? k} />
        <GroupCard title="بر اساس وضعیت" rows={d.data!.byStatus} label={(k) => STATUS_LABELS[k as MaintenanceStatus] ?? k} />
        <GroupCard title="بر اساس اولویت" rows={d.data!.byPriority} label={(k) => PRIORITY_LABELS[k as MaintenancePriority] ?? k} />
        <GroupCard title="آماده‌بودن اتاق‌ها" rows={d.data!.roomReadiness} label={(k) => READINESS_LABELS[k as RoomReadinessStatus] ?? k} />
      </div>
    </>
  );
}

function GroupCard({
  title,
  rows,
  label,
}: {
  title: string;
  rows: Array<{ key: string; count: number }>;
  label: (k: string) => string;
}) {
  return (
    <section className="card">
      <h3>{title}</h3>
      {rows.length === 0 ? (
        <p className="hint">داده‌ای نیست.</p>
      ) : (
        <table className="simple-table">
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td>{label(r.key)}</td>
                <td>{r.count.toLocaleString('fa-IR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function Requests({ workspaceId, queryClient }: { workspaceId: string; queryClient: ReturnType<typeof useQueryClient> }) {
  const [filters, setFilters] = useState<{ status?: MaintenanceStatus; category?: MaintenanceCategory; q?: string }>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const list = useQuery({
    queryKey: ['maint-requests', workspaceId, filters],
    queryFn: () => maintenanceApi.listRequests(workspaceId, filters),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['maint-requests'] });
    void queryClient.invalidateQueries({ queryKey: ['maint-dashboard'] });
  };

  const create = useMutation({
    mutationFn: (body: { description: string; category: MaintenanceCategory; priority: MaintenancePriority; room: string; requesterName: string }) =>
      maintenanceApi.createRequest(workspaceId, body),
    onSuccess: () => { setMessage('درخواست ثبت شد.'); refresh(); },
    onError: (e) => setMessage(describeError(e)),
  });

  return (
    <>
      {message && <p className="hint">{message}</p>}
      <CreateForm onSubmit={(b) => create.mutate(b)} pending={create.isPending} />

      <section className="card">
        <div className="inline-form">
          <select value={filters.status ?? ''} onChange={(e) => setFilters((f) => ({ ...f, status: (e.target.value || undefined) as MaintenanceStatus }))}>
            <option value="">همه‌ی وضعیت‌ها</option>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
          <select value={filters.category ?? ''} onChange={(e) => setFilters((f) => ({ ...f, category: (e.target.value || undefined) as MaintenanceCategory }))}>
            <option value="">همه‌ی دسته‌ها</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
          <input placeholder="جستجو…" value={filters.q ?? ''} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value || undefined }))} />
        </div>

        {list.isLoading ? <p>در حال بارگذاری…</p> : (
          <table className="simple-table">
            <thead>
              <tr><th>#</th><th>شرح</th><th>دسته</th><th>اتاق</th><th>اولویت</th><th>وضعیت</th><th>فنی‌کار</th><th></th></tr>
            </thead>
            <tbody>
              {(list.data ?? []).map((r) => (
                <tr key={r.id}>
                  <td>{r.requestNo}</td>
                  <td>{r.description.slice(0, 50)}</td>
                  <td>{CATEGORY_LABELS[r.category]}</td>
                  <td>{r.room || '—'}</td>
                  <td>{PRIORITY_LABELS[r.priority]}</td>
                  <td>{STATUS_LABELS[r.status]}</td>
                  <td>{r.assignedTo || '—'}</td>
                  <td><button type="button" className="link-button" onClick={() => setSelected(r.id)}>جزئیات</button></td>
                </tr>
              ))}
              {(list.data ?? []).length === 0 && <tr><td colSpan={8} className="hint">درخواستی نیست.</td></tr>}
            </tbody>
          </table>
        )}
      </section>

      {selected && (
        <RequestDetail workspaceId={workspaceId} id={selected} onClose={() => setSelected(null)} onChanged={refresh} />
      )}
    </>
  );
}

function CreateForm({ onSubmit, pending }: { onSubmit: (b: { description: string; category: MaintenanceCategory; priority: MaintenancePriority; room: string; requesterName: string }) => void; pending: boolean }) {
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<MaintenanceCategory>('other');
  const [priority, setPriority] = useState<MaintenancePriority>('normal');
  const [room, setRoom] = useState('');
  const [requesterName, setRequesterName] = useState('');
  return (
    <section className="card">
      <h3>ثبت درخواست تازه</h3>
      <label>شرح مشکل<textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
      <div className="inline-form">
        <label className="inline-select"><span>دسته</span>
          <select value={category} onChange={(e) => setCategory(e.target.value as MaintenanceCategory)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
        </label>
        <label className="inline-select"><span>اولویت</span>
          <select value={priority} onChange={(e) => setPriority(e.target.value as MaintenancePriority)}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
          </select>
        </label>
        <input placeholder="اتاق/مکان" value={room} onChange={(e) => setRoom(e.target.value)} />
        <input placeholder="درخواست‌کننده" value={requesterName} onChange={(e) => setRequesterName(e.target.value)} />
        <button type="button" disabled={pending || !description.trim()} onClick={() => onSubmit({ description, category, priority, room, requesterName })}>
          {pending ? 'در حال ثبت…' : 'ثبت درخواست'}
        </button>
      </div>
    </section>
  );
}

function RequestDetail({ workspaceId, id, onClose, onChanged }: { workspaceId: string; id: string; onClose: () => void; onChanged: () => void }) {
  const q = useQuery({ queryKey: ['maint-request', id], queryFn: () => maintenanceApi.getRequest(workspaceId, id) });
  const [status, setStatus] = useState<MaintenanceStatus | ''>('');
  const [assignedTo, setAssignedTo] = useState('');
  const [note, setNote] = useState('');

  const update = useMutation({
    mutationFn: (body: Partial<MaintenanceRequest> & { eventNote?: string }) => maintenanceApi.updateRequest(workspaceId, id, body),
    onSuccess: () => { void q.refetch(); onChanged(); setNote(''); },
  });
  const archive = useMutation({
    mutationFn: () => maintenanceApi.archiveRequest(workspaceId, id),
    onSuccess: () => { onChanged(); onClose(); },
  });

  if (q.isLoading) return <section className="card">در حال بارگذاری…</section>;
  if (q.isError || !q.data) return <section className="card"><p className="error">{describeError(q.error)}</p><button onClick={onClose}>بستن</button></section>;
  const r = q.data.request;

  return (
    <section className="card">
      <div className="section-head">
        <h3>درخواست #{r.requestNo} — {STATUS_LABELS[r.status]}</h3>
        <button type="button" onClick={onClose}>بستن</button>
      </div>
      <p>{r.description}</p>
      <p className="hint">دسته: {CATEGORY_LABELS[r.category]} · اولویت: {PRIORITY_LABELS[r.priority]} · اتاق: {r.room || '—'} · درخواست‌کننده: {r.requesterName || '—'}</p>

      <div className="inline-form">
        <label className="inline-select"><span>تغییر وضعیت</span>
          <select value={status || r.status} onChange={(e) => setStatus(e.target.value as MaintenanceStatus)}>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </select>
        </label>
        <input placeholder="واگذاری به فنی‌کار" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} />
        <input placeholder="یادداشت کار" value={note} onChange={(e) => setNote(e.target.value)} />
        <button type="button" disabled={update.isPending} onClick={() => update.mutate({
          ...(status && status !== r.status ? { status } : {}),
          ...(assignedTo ? { assignedTo } : {}),
          ...(note ? { eventNote: note } : {}),
        } as Partial<MaintenanceRequest> & { eventNote?: string })}>به‌روزرسانی</button>
        <button type="button" className="danger" onClick={() => { if (window.confirm('این درخواست بایگانی شود؟')) archive.mutate(); }}>بایگانی</button>
      </div>

      <h4>تاریخچه</h4>
      <table className="simple-table">
        <tbody>
          {q.data.history.map((h) => (
            <tr key={h.id}>
              <td>{isoToJalaliText(h.createdAt)}</td>
              <td>{h.action}</td>
              <td>{h.fromValue ? `${h.fromValue} ← ` : ''}{h.toValue ?? ''}{h.note}</td>
              <td>{h.actorName}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Rooms({ workspaceId, queryClient }: { workspaceId: string; queryClient: ReturnType<typeof useQueryClient> }) {
  const [room, setRoom] = useState('');
  const [status, setStatus] = useState<RoomReadinessStatus>('needs_inspection');
  const [note, setNote] = useState('');

  const rooms = useQuery({ queryKey: ['maint-rooms', workspaceId], queryFn: () => maintenanceApi.listRooms(workspaceId) });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['maint-rooms'] });
    void queryClient.invalidateQueries({ queryKey: ['maint-dashboard'] });
  };
  const save = useMutation({
    mutationFn: () => maintenanceApi.setRoom(workspaceId, { room, status, note }),
    onSuccess: () => { setRoom(''); setNote(''); refresh(); },
  });

  return (
    <>
      <section className="card">
        <h3>تعیین آماده‌بودن اتاق</h3>
        <p className="hint">آماده‌بودن اتاق مستقل از وضعیت درخواست تعمیر است؛ بسته‌شدن تیکت اتاق را خودکار آماده نمی‌کند.</p>
        <div className="inline-form">
          <input placeholder="شماره اتاق" value={room} onChange={(e) => setRoom(e.target.value)} />
          <label className="inline-select"><span>وضعیت</span>
            <select value={status} onChange={(e) => setStatus(e.target.value as RoomReadinessStatus)}>
              {READINESS.map((s) => <option key={s} value={s}>{READINESS_LABELS[s]}</option>)}
            </select>
          </label>
          <input placeholder="یادداشت" value={note} onChange={(e) => setNote(e.target.value)} />
          <button type="button" disabled={save.isPending || !room.trim()} onClick={() => save.mutate()}>ثبت</button>
        </div>
      </section>

      <section className="card">
        <h3>اتاق‌ها</h3>
        {rooms.isLoading ? <p>در حال بارگذاری…</p> : (
          <table className="simple-table">
            <thead><tr><th>اتاق</th><th>وضعیت</th><th>یادداشت</th><th>آخرین تغییر</th></tr></thead>
            <tbody>
              {(rooms.data ?? []).map((r) => (
                <tr key={r.id}>
                  <td>{r.room}</td>
                  <td>{READINESS_LABELS[r.status]}</td>
                  <td>{r.note || '—'}</td>
                  <td>{r.updatedByName || '—'} · {isoToJalaliText(r.updatedAt)}</td>
                </tr>
              ))}
              {(rooms.data ?? []).length === 0 && <tr><td colSpan={4} className="hint">اتاقی ثبت نشده.</td></tr>}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
