import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  cmmsApi,
  describeError,
  type CmmsQuery,
  type SparePart,
} from '../../api';
import { Modal } from './CmmsForms';

/** برچسبِ فارسیِ نوعِ گردش. */
const MOVEMENT_LABELS: Record<string, string> = {
  receipt: 'ورود',
  issue: 'مصرف',
  return: 'برگشت',
  scrap: 'ضایعات',
  adjust_in: 'اصلاحِ افزایشی',
  adjust_out: 'اصلاحِ کاهشی',
};

/** گردش‌هایی که انباردار از روی جدول ثبت می‌کند. */
const MANUAL_TYPES: Array<{ value: string; label: string }> = [
  { value: 'receipt', label: 'ورود (خرید/تحویل)' },
  { value: 'issue', label: 'مصرف' },
  { value: 'return', label: 'برگشت به انبار' },
  { value: 'scrap', label: 'ضایعات' },
];

const fa = (n: number) => n.toLocaleString('fa-IR');
const shortDate = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString('fa-IR') : '—';

/** آیا این قطعه باید سفارش داده شود؟ */
const isLow = (p: SparePart) =>
  p.reorderLevel > 0 && p.quantityOnHand <= p.reorderLevel;

/**
 * انبارِ قطعاتِ فنی.
 *
 * موجودی در هیچ فیلدی قابلِ تایپ نیست: هر تغییر از یک گردشِ ثبت‌شده
 * می‌آید (ورود، مصرف، برگشت، ضایعات، انبارگردانی)، همان‌طور که سرور هم
 * اجازهٔ دیگری نمی‌دهد. پس عددِ روی جدول همیشه پشتوانهٔ سند دارد.
 */
export function InventoryPanel({
  lowStockOnly = false,
}: {
  lowStockOnly?: boolean;
}) {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [onlyLow, setOnlyLow] = useState(lowStockOnly);
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  /** قطعه و نوعِ گردشی که فرمش باز است. */
  const [moving, setMoving] = useState<{
    part: SparePart;
    type: string;
  } | null>(null);
  const [counting, setCounting] = useState<SparePart | null>(null);
  /** دفترِ گردشِ کدام قطعه باز است (خالی = کلِ انبار). */
  const [ledgerOf, setLedgerOf] = useState<SparePart | null>(null);
  const [showLedger, setShowLedger] = useState(false);

  const query: CmmsQuery = {
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(onlyLow ? { lowStock: true } : {}),
    page,
    pageSize: 20,
  };

  const parts = useQuery({
    queryKey: ['cmms-parts', search, onlyLow, page],
    queryFn: () => cmmsApi.parts(query),
  });

  const ledger = useQuery({
    queryKey: ['cmms-stock-movements', ledgerOf?.id ?? 'all'],
    queryFn: () =>
      cmmsApi.stockMovements({
        ...(ledgerOf ? { partId: ledgerOf.id } : {}),
        pageSize: 30,
      }),
    enabled: showLedger,
  });

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: ['cmms-parts'] });
    await qc.invalidateQueries({ queryKey: ['cmms-stock-movements'] });
    // موجودی روی سطل‌های داشبورد و هزینهٔ دستورِ کار هم اثر دارد.
    await qc.invalidateQueries({ queryKey: ['cmms-dashboard'] });
    await qc.invalidateQueries({ queryKey: ['cmms-records'] });
  };

  return (
    <section className="card">
      <div className="section-head">
        <h3>انبارِ قطعات</h3>
        <span className="question-actions">
          <button type="button" onClick={() => setCreating(true)}>
            + قطعه
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setLedgerOf(null);
              setShowLedger((v) => !v);
            }}
          >
            {showLedger ? 'بستنِ دفتر' : 'دفترِ گردش'}
          </button>
        </span>
      </div>

      <div className="inline-form">
        <input
          value={search}
          placeholder="جست‌وجو در نام، کد یا تأمین‌کننده…"
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={onlyLow}
            onChange={(e) => {
              setOnlyLow(e.target.checked);
              setPage(1);
            }}
          />
          فقط زیرِ نقطهٔ سفارش
        </label>
      </div>

      {parts.isLoading && <p>در حال بارگذاری…</p>}
      {parts.isError && <p className="error">خواندنِ انبار ناموفق بود.</p>}
      {parts.data && parts.data.rows.length === 0 && (
        <p className="hint">
          {onlyLow
            ? 'همهٔ قطعات بالای نقطهٔ سفارش‌اند.'
            : 'قطعه‌ای ثبت نشده است.'}
        </p>
      )}

      {parts.data && parts.data.rows.length > 0 && (
        <>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>کد</th>
                  <th>نام</th>
                  <th>موجودی</th>
                  <th>نقطهٔ سفارش</th>
                  <th>قیمتِ واحد</th>
                  <th>جای نگهداری</th>
                  <th>گردش</th>
                </tr>
              </thead>
              <tbody>
                {parts.data.rows.map((p) => (
                  <tr key={p.id}>
                    <td>{p.code}</td>
                    <td>{p.name}</td>
                    <td>
                      <strong
                        style={{
                          color: isLow(p) ? '#b45309' : 'inherit',
                        }}
                        title={
                          isLow(p) ? 'زیرِ نقطهٔ سفارش — باید سفارش داد' : ''
                        }
                      >
                        {fa(p.quantityOnHand)} {p.unit}
                      </strong>
                    </td>
                    <td>{p.reorderLevel > 0 ? fa(p.reorderLevel) : '—'}</td>
                    <td>{fa(p.unitCost)}</td>
                    <td>{p.location || '—'}</td>
                    <td>
                      <span className="question-actions">
                        <button
                          type="button"
                          onClick={() =>
                            setMoving({ part: p, type: 'receipt' })
                          }
                        >
                          ورود
                        </button>
                        <button
                          type="button"
                          disabled={p.quantityOnHand === 0}
                          title={
                            p.quantityOnHand === 0
                              ? 'موجودی صفر است'
                              : 'خروج برای مصرف'
                          }
                          onClick={() => setMoving({ part: p, type: 'issue' })}
                        >
                          مصرف
                        </button>
                        <button type="button" onClick={() => setCounting(p)}>
                          شمارش
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setLedgerOf(p);
                            setShowLedger(true);
                          }}
                        >
                          دفتر
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="inline-form">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((v) => v - 1)}
            >
              قبلی
            </button>
            <span className="hint">
              صفحهٔ {fa(parts.data.page)} از{' '}
              {fa(Math.max(1, Math.ceil(parts.data.total / parts.data.pageSize)))}{' '}
              — مجموع {fa(parts.data.total)}
            </span>
            <button
              type="button"
              disabled={
                parts.data.page * parts.data.pageSize >= parts.data.total
              }
              onClick={() => setPage((v) => v + 1)}
            >
              بعدی
            </button>
          </div>
        </>
      )}

      {showLedger && (
        <section style={{ marginTop: '1rem' }}>
          <div className="section-head">
            <h4>
              دفترِ گردش
              {ledgerOf ? ` — ${ledgerOf.code} ${ledgerOf.name}` : ''}
            </h4>
            {ledgerOf && (
              <button
                type="button"
                className="link-button"
                onClick={() => setLedgerOf(null)}
              >
                نمایشِ کلِ انبار
              </button>
            )}
          </div>
          {ledger.isLoading && <p>در حال بارگذاری…</p>}
          {ledger.data && ledger.data.rows.length === 0 && (
            <p className="hint">گردشی ثبت نشده است.</p>
          )}
          {ledger.data && ledger.data.rows.length > 0 && (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>تاریخ</th>
                    <th>قطعه</th>
                    <th>نوع</th>
                    <th>تعداد</th>
                    <th>موجودیِ پس از آن</th>
                    <th>مبلغ</th>
                    <th>مرجع</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.data.rows.map((m) => (
                    <tr key={m.id}>
                      <td>{shortDate(m.createdAt)}</td>
                      <td>
                        {m.partCode} — {m.partName}
                      </td>
                      <td>{MOVEMENT_LABELS[m.type] ?? m.type}</td>
                      <td>
                        {fa(m.quantity)} {m.partUnit}
                      </td>
                      <td>{fa(m.balanceAfter)}</td>
                      <td>{fa(m.totalCost)}</td>
                      <td>{m.reference || m.note || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {creating && (
        <NewPartForm
          onClose={() => setCreating(false)}
          onSaved={() => void refresh()}
        />
      )}
      {moving && (
        <MovementForm
          part={moving.part}
          initialType={moving.type}
          onClose={() => setMoving(null)}
          onSaved={() => void refresh()}
        />
      )}
      {counting && (
        <RecountForm
          part={counting}
          onClose={() => setCounting(null)}
          onSaved={() => void refresh()}
        />
      )}
    </section>
  );
}

/** ثبتِ قطعهٔ تازه، با موجودیِ اولیه به‌شکلِ یک «ورود». */
function NewPartForm({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    code: '',
    name: '',
    category: '',
    unit: 'عدد',
    reorderLevel: '',
    unitCost: '',
    openingQuantity: '',
    location: '',
    supplier: '',
  });

  const save = useMutation({
    mutationFn: () =>
      cmmsApi.createPart({
        code: form.code.trim(),
        name: form.name.trim(),
        category: form.category.trim(),
        unit: form.unit.trim() || 'عدد',
        location: form.location.trim(),
        supplier: form.supplier.trim(),
        reorderLevel: Number(form.reorderLevel || 0),
        unitCost: Number(form.unitCost || 0),
        openingQuantity: Number(form.openingQuantity || 0),
      }),
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });

  const set = (k: keyof typeof form) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal title="قطعهٔ تازه" onClose={onClose}>
      <div className="form-grid">
        <label>
          کدِ انبار *
          <input
            value={form.code}
            onChange={(e) => set('code')(e.target.value)}
          />
        </label>
        <label>
          نامِ قطعه *
          <input
            value={form.name}
            onChange={(e) => set('name')(e.target.value)}
          />
        </label>
        <label>
          دسته
          <input
            value={form.category}
            onChange={(e) => set('category')(e.target.value)}
          />
        </label>
        <label>
          واحد
          <input
            value={form.unit}
            onChange={(e) => set('unit')(e.target.value)}
          />
        </label>
        <label>
          موجودیِ اولیه
          <input
            type="number"
            min={0}
            value={form.openingQuantity}
            onChange={(e) => set('openingQuantity')(e.target.value)}
          />
        </label>
        <label>
          نقطهٔ سفارش
          <input
            type="number"
            min={0}
            value={form.reorderLevel}
            onChange={(e) => set('reorderLevel')(e.target.value)}
          />
        </label>
        <label>
          قیمتِ واحد (ریال)
          <input
            type="number"
            min={0}
            value={form.unitCost}
            onChange={(e) => set('unitCost')(e.target.value)}
          />
        </label>
        <label>
          جای نگهداری
          <input
            value={form.location}
            onChange={(e) => set('location')(e.target.value)}
          />
        </label>
        <label>
          تأمین‌کننده
          <input
            value={form.supplier}
            onChange={(e) => set('supplier')(e.target.value)}
          />
        </label>
      </div>
      <p className="hint">
        موجودیِ اولیه به‌شکلِ یک «ورود» در دفترِ گردش ثبت می‌شود، پس دفتر از
        روزِ اول کامل است.
      </p>
      {save.isError && <p className="error">{describeError(save.error)}</p>}
      <div className="inline-form">
        <button
          type="button"
          disabled={save.isPending || !form.code.trim() || !form.name.trim()}
          onClick={() => save.mutate()}
        >
          {save.isPending ? 'در حال ثبت…' : 'ثبت'}
        </button>
      </div>
    </Modal>
  );
}

/** ورود، مصرف، برگشت یا ضایعاتِ یک قطعه. */
function MovementForm({
  part,
  initialType,
  onClose,
  onSaved,
}: {
  part: SparePart;
  initialType: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState(initialType);
  const [quantity, setQuantity] = useState('1');
  const [unitCost, setUnitCost] = useState(String(part.unitCost));
  const [workOrderId, setWorkOrderId] = useState('');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');

  /** دستورِ کارهای بازی که قطعه می‌پذیرند. */
  const orders = useQuery({
    queryKey: ['cmms-open-orders'],
    queryFn: () => cmmsApi.workOrders({ pageSize: 100 }),
  });
  const openOrders = (orders.data?.rows ?? []).filter(
    (o) => !['verified', 'closed', 'cancelled'].includes(o.status),
  );

  const save = useMutation({
    mutationFn: () =>
      cmmsApi.move({
        partId: part.id,
        type,
        quantity: Number(quantity || 0),
        unitCost: Number(unitCost || 0),
        workOrderId: workOrderId || null,
        reference: reference.trim(),
        note: note.trim(),
      }),
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });

  const outbound = type === 'issue' || type === 'scrap';
  const n = Number(quantity || 0);
  const tooMuch = outbound && n > part.quantityOnHand;

  return (
    <Modal title={`گردشِ انبار — ${part.name}`} onClose={onClose}>
      <p className="hint">
        موجودیِ فعلی: <strong>{fa(part.quantityOnHand)} {part.unit}</strong>
      </p>
      <div className="form-grid">
        <label>
          نوعِ گردش
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {MANUAL_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          تعداد *
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </label>
        <label>
          قیمتِ واحد (ریال)
          <input
            type="number"
            min={0}
            value={unitCost}
            onChange={(e) => setUnitCost(e.target.value)}
          />
        </label>
        <label>
          دستورِ کار
          <select
            value={workOrderId}
            onChange={(e) => setWorkOrderId(e.target.value)}
          >
            <option value="">— بدونِ دستورِ کار —</option>
            {openOrders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.number} — {o.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          شمارهٔ فاکتور / حواله
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </label>
        <label>
          یادداشت
          <input value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      </div>

      {type === 'issue' && workOrderId && (
        <p className="hint">
          مبلغِ این مصرف به هزینهٔ داخلیِ همان دستورِ کار اضافه می‌شود.
        </p>
      )}
      {tooMuch && (
        <p className="error">
          موجودی {fa(part.quantityOnHand)} {part.unit} است؛ بیشتر از آن خارج
          نمی‌شود.
        </p>
      )}
      {save.isError && <p className="error">{describeError(save.error)}</p>}

      <div className="inline-form">
        <button
          type="button"
          disabled={save.isPending || n < 1 || tooMuch}
          onClick={() => save.mutate()}
        >
          {save.isPending ? 'در حال ثبت…' : 'ثبتِ گردش'}
        </button>
      </div>
    </Modal>
  );
}

/** انبارگردانی: شمارشِ واقعیِ قفسه. */
function RecountForm({
  part,
  onClose,
  onSaved,
}: {
  part: SparePart;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [counted, setCounted] = useState(String(part.quantityOnHand));
  const [note, setNote] = useState('');

  const save = useMutation({
    mutationFn: () =>
      cmmsApi.recount(part.id, Number(counted || 0), note.trim()),
    onSuccess: () => {
      onSaved();
      onClose();
    },
  });

  const diff = Number(counted || 0) - part.quantityOnHand;

  return (
    <Modal title={`انبارگردانی — ${part.name}`} onClose={onClose}>
      <div className="form-grid">
        <label>
          موجودیِ ثبت‌شده
          <input value={`${fa(part.quantityOnHand)} ${part.unit}`} readOnly />
        </label>
        <label>
          شمارشِ واقعی *
          <input
            type="number"
            min={0}
            value={counted}
            onChange={(e) => setCounted(e.target.value)}
          />
        </label>
        <label>
          علتِ اختلاف
          <input value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      </div>
      <p className="hint">
        {diff === 0
          ? 'اختلافی نیست؛ چیزی در دفتر نوشته نمی‌شود.'
          : `اختلاف ${fa(Math.abs(diff))} ${part.unit} ${
              diff > 0 ? 'افزایشی' : 'کاهشی'
            } به‌شکلِ گردشِ اصلاحی ثبت می‌شود.`}
      </p>
      {save.isError && <p className="error">{describeError(save.error)}</p>}
      <div className="inline-form">
        <button
          type="button"
          disabled={save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending ? 'در حال ثبت…' : 'ثبتِ شمارش'}
        </button>
      </div>
    </Modal>
  );
}
