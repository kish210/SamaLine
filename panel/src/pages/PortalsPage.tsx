import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { describeError, formsApi, portalsApi, workspaceApi } from '../api';
import type { Portal } from '../types';
import { RENDERER_BASE } from '../renderer-url';

/**
 * پرتال: چند فرم روی یک نشانی عمومی.
 *
 * برای مجموعه‌ای که همزمان چند نظرسنجی دارد و نمی‌خواهد چند لینک جدا پخش
 * کند — یک نشانی روی بنر یا QR، و مخاطب خودش انتخاب می‌کند.
 */
export function PortalsPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Portal | 'new' | null>(null);
  const [message, setMessage] = useState('');

  const workspaces = useQuery({
    queryKey: ['workspaces'],
    queryFn: workspaceApi.list,
  });
  const workspaceId = workspaces.data?.[0]?.id ?? '';

  const portals = useQuery({
    queryKey: ['portals', workspaceId],
    queryFn: () => portalsApi.list(workspaceId),
    enabled: Boolean(workspaceId),
  });

  const forms = useQuery({
    queryKey: ['forms', workspaceId],
    queryFn: () => formsApi.list(workspaceId),
    enabled: Boolean(workspaceId),
  });

  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: ['portals'] });

  const remove = useMutation({
    mutationFn: (id: string) => portalsApi.remove(workspaceId, id),
    onSuccess: () => {
      setMessage('پرتال حذف شد.');
      refresh();
    },
    onError: (error) => setMessage(describeError(error)),
  });

  return (
    <div className="page">
      <header className="page-header">
        <h1>پرتال</h1>
        <div className="header-actions">
          <button type="button" onClick={() => setEditing('new')}>
            پرتال تازه
          </button>
        </div>
      </header>

      <p className="hint">
        چند فرم را روی یک نشانی جمع می‌کند. مخاطب یک لینک می‌گیرد و خودش
        انتخاب می‌کند به کدام پاسخ بدهد.
      </p>

      {message && <p className="hint">{message}</p>}

      {portals.isLoading && <p>در حال بارگذاری…</p>}

      {portals.data?.length === 0 && !editing && (
        <p className="empty">هنوز پرتالی نساخته‌اید.</p>
      )}

      {portals.data?.map((portal) => (
        <section key={portal.id} className="card">
          <div className="section-head">
            <h3>{portal.title}</h3>
            <div className="inline-form">
              <button
                type="button"
                className="secondary"
                onClick={() => setEditing(portal)}
              >
                ویرایش
              </button>
              <button
                type="button"
                className="danger"
                onClick={() => remove.mutate(portal.id)}
              >
                حذف
              </button>
            </div>
          </div>

          <p className="hint" dir="ltr">
            <a
              href={`${RENDERER_BASE}/p/${portal.slug}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {`${RENDERER_BASE}/p/${portal.slug}`}
            </a>
          </p>

          <p className="hint">
            {portal.formIds.length} فرم
            {!portal.isActive && ' · غیرفعال'}
          </p>
        </section>
      ))}

      {editing && (
        <PortalEditor
          workspaceId={workspaceId}
          portal={editing === 'new' ? null : editing}
          forms={forms.data ?? []}
          onDone={(text) => {
            setMessage(text);
            setEditing(null);
            refresh();
          }}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  );
}

interface EditorProps {
  workspaceId: string;
  portal: Portal | null;
  forms: Array<{ id: string; title: string }>;
  onDone: (message: string) => void;
  onCancel: () => void;
}

function PortalEditor({
  workspaceId,
  portal,
  forms,
  onDone,
  onCancel,
}: EditorProps) {
  const [slug, setSlug] = useState(portal?.slug ?? '');
  const [title, setTitle] = useState(portal?.title ?? '');
  const [description, setDescription] = useState(portal?.description ?? '');
  const [logoUrl, setLogoUrl] = useState(portal?.logoUrl ?? '');
  const [isActive, setIsActive] = useState(portal?.isActive ?? true);
  const [formIds, setFormIds] = useState<string[]>(portal?.formIds ?? []);
  const [error, setError] = useState('');

  const save = useMutation({
    mutationFn: () =>
      portalsApi.save(workspaceId, portal?.id ?? null, {
        slug: slug.trim(),
        title: title.trim(),
        description: description.trim(),
        logoUrl: logoUrl.trim(),
        formIds,
        isActive,
      }),
    onSuccess: () => onDone(portal ? 'پرتال ذخیره شد.' : 'پرتال ساخته شد.'),
    onError: (err) => setError(describeError(err)),
  });

  const toggle = (id: string, checked: boolean) =>
    // ترتیب انتخاب حفظ می‌شود؛ همان ترتیبی است که روی صفحه دیده می‌شود.
    setFormIds((prev) =>
      checked ? [...prev, id] : prev.filter((f) => f !== id),
    );

  const move = (index: number, direction: -1 | 1) =>
    setFormIds((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const titleOf = (id: string) =>
    forms.find((f) => f.id === id)?.title ?? 'فرم حذف‌شده';

  return (
    <section className="card">
      <h3>{portal ? 'ویرایش پرتال' : 'پرتال تازه'}</h3>

      <div className="form-grid">
        <label>
          <span className="field-label">نشانی</span>
          <span className="url-row">
            <span className="url-prefix">{RENDERER_BASE}/p/</span>
            <input
              dir="ltr"
              placeholder="hotel-kish"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
          </span>
          <small className="hint">
            فقط حروف کوچک انگلیسی، رقم و خط تیره.
          </small>
        </label>

        <label>
          <span className="field-label">عنوان صفحه</span>
          <input
            placeholder="نظرسنجی‌های هتل کیش"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
      </div>

      <label>
        <span className="field-label">توضیح</span>
        <textarea
          rows={2}
          placeholder="یک جمله زیر عنوان صفحه"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>

      <label>
        <span className="field-label">نشانی لوگو</span>
        <input
          dir="ltr"
          placeholder="https://…"
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
        />
      </label>

      <label className="checkbox">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
        />
        فعال
      </label>

      <h4>فرم‌های این پرتال</h4>
      {forms.length === 0 ? (
        <p className="empty">هنوز فرمی نساخته‌اید.</p>
      ) : (
        <div className="portal-picker">
          {forms.map((form) => (
            <label key={form.id} className="checkbox">
              <input
                type="checkbox"
                checked={formIds.includes(form.id)}
                onChange={(e) => toggle(form.id, e.target.checked)}
              />
              {form.title}
            </label>
          ))}
        </div>
      )}

      {formIds.length > 0 && (
        <>
          <h4>ترتیب نمایش</h4>
          <ol className="rule-list">
            {formIds.map((id, index) => (
              <li key={id}>
                <span>{titleOf(id)}</span>
                <span className="edge-actions">
                  <button type="button" onClick={() => move(index, -1)}>
                    ↑
                  </button>
                  <button type="button" onClick={() => move(index, 1)}>
                    ↓
                  </button>
                </span>
              </li>
            ))}
          </ol>
          <p className="hint">
            فرمی که هنوز منتشر نشده باشد روی صفحه‌ی عمومی دیده نمی‌شود.
          </p>
        </>
      )}

      {error && <p className="error">{error}</p>}

      <div className="inline-form">
        <button
          type="button"
          onClick={() => save.mutate()}
          disabled={save.isPending || !slug.trim() || !title.trim()}
        >
          {save.isPending ? 'در حال ذخیره…' : 'ذخیره'}
        </button>
        <button type="button" className="secondary" onClick={onCancel}>
          انصراف
        </button>
      </div>
    </section>
  );
}
