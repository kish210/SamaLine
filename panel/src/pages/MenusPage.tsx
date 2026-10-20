import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { renderSVG } from "uqr";
import {
  absoluteUploadUrl,
  describeError,
  menusApi,
  uploadApi,
  workspaceApi,
} from "../api";
import { menuUrl } from "../renderer-url";
import type { Menu, MenuSection, MenuTemplateSummary } from "../types";

/** شناسه‌ی کوتاه و یکتا برای بخش و قلم تازه. */
const newId = (prefix: string) =>
  `${prefix}_${Math.random().toString(36).slice(2, 8)}`;

const emptySection = (): MenuSection => ({
  id: newId("s"),
  title: "",
  items: [{ id: newId("i"), name: "", description: "", price: "" }],
});

/**
 * منوی QR: صفحه‌ای که مهمان با اسکن کد روی میز باز می‌کند.
 *
 * دو شکل محتوا دارد و هر دو با هم هم ممکن است: عکسِ منوی چاپی، و فهرست
 * دستیِ قیمت که روی موبایل بهتر خوانده می‌شود و به‌روزرسانی‌اش آسان‌تر است.
 */
export function MenusPage() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Menu | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newSlug, setNewSlug] = useState("");
  const [templateKey, setTemplateKey] = useState("blank");
  const [uploading, setUploading] = useState(false);

  const workspaces = useQuery({
    queryKey: ["workspaces"],
    queryFn: workspaceApi.list,
  });
  const workspaceId = workspaces.data?.[0]?.id ?? "";

  const menus = useQuery({
    queryKey: ["menus", workspaceId],
    queryFn: () => menusApi.list(workspaceId),
    enabled: Boolean(workspaceId),
  });

  const templates = useQuery({
    queryKey: ["menu-templates"],
    queryFn: menusApi.templates,
    staleTime: 60 * 60 * 1000,
  });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["menus", workspaceId] });

  const create = useMutation({
    mutationFn: () =>
      menusApi.save(workspaceId, null, {
        slug: newSlug.trim(),
        templateKey,
      }),
    onSuccess: async (menu) => {
      setNewSlug("");
      setTemplateKey("blank");
      setError(null);
      setEditing(menu);
      await refresh();
    },
    onError: (err) => setError(describeError(err)),
  });

  const save = useMutation({
    mutationFn: (menu: Menu) =>
      menusApi.save(workspaceId, menu.id, {
        slug: menu.slug,
        title: menu.title,
        description: menu.description,
        logoUrl: menu.logoUrl,
        images: menu.images,
        sections: menu.sections,
        isActive: menu.isActive,
      }),
    onSuccess: async (menu) => {
      setEditing(menu);
      setError(null);
      await refresh();
    },
    onError: (err) => setError(describeError(err)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => menusApi.remove(workspaceId, id),
    onSuccess: async () => {
      setEditing(null);
      await refresh();
    },
    onError: (err) => setError(describeError(err)),
  });

  const publicUrl = useMemo(
    () => (editing ? menuUrl(editing.slug) : ""),
    [editing],
  );
  const qrSvg = useMemo(
    () => (publicUrl ? renderSVG(publicUrl, { border: 1 }) : ""),
    [publicUrl],
  );

  const patch = (changes: Partial<Menu>) =>
    setEditing((current) => (current ? { ...current, ...changes } : current));

  const upload = async (file: File, target: "logo" | "image") => {
    setUploading(true);
    try {
      const saved = await uploadApi.image(file);
      const url = absoluteUploadUrl(saved.url);
      if (target === "logo") patch({ logoUrl: url });
      else patch({ images: [...(editing?.images ?? []), url] });
      setError(null);
    } catch (err) {
      setError(describeError(err));
    } finally {
      setUploading(false);
    }
  };

  const downloadQr = () => {
    if (!editing) return;
    const blob = new Blob([qrSvg], { type: "image/svg+xml" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `menu-${editing.slug}.svg`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const grouped = useMemo(() => {
    const list = templates.data ?? [];
    return list.reduce<Record<string, MenuTemplateSummary[]>>((acc, t) => {
      (acc[t.category] ??= []).push(t);
      return acc;
    }, {});
  }, [templates.data]);

  return (
    <div className="page">
      <header className="page-header">
        <h1>منوی QR</h1>
      </header>

      {error && <p className="error">{error}</p>}

      <section className="card">
        <h3>ساخت منوی تازه</h3>
        <p className="hint">
          نشانک، همان چیزی است که در نشانی و روی QR می‌آید — کوتاه و لاتین، مثل{" "}
          <code dir="ltr">kourosh-room</code>.
        </p>
        <div className="stack-form">
          <label>
            نشانک
            <input
              dir="ltr"
              placeholder="kourosh-room"
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
            />
          </label>
          <label>
            قالب آماده
            <select
              value={templateKey}
              onChange={(e) => setTemplateKey(e.target.value)}
            >
              {Object.entries(grouped).map(([category, items]) => (
                <optgroup key={category} label={category}>
                  {items.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.icon} {t.title}
                      {t.itemCount > 0
                        ? ` (${t.itemCount.toLocaleString("fa-IR")} قلم)`
                        : ""}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={!workspaceId || !newSlug.trim() || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? "در حال ساخت…" : "ساخت منو"}
          </button>
        </div>
      </section>

      {menus.data && menus.data.length > 0 && (
        <section className="card">
          <h3>منوهای شما</h3>
          <div className="table-scroll">
            <table>
              <tbody>
                {menus.data.map((menu) => (
                  <tr key={menu.id}>
                    <td>
                      {menu.title}
                      {!menu.isActive && (
                        <span className="chip-count"> (خاموش)</span>
                      )}
                    </td>
                    <td dir="ltr">
                      <code>/m/{menu.slug}</code>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="secondary"
                        style={{ width: "auto" }}
                        onClick={() => {
                          setEditing(menu);
                          setError(null);
                        }}
                      >
                        ویرایش
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {editing && (
        <section className="card">
          <h3>ویرایش: {editing.title}</h3>

          <div className="stack-form">
            <label>
              عنوان
              <input
                value={editing.title}
                onChange={(e) => patch({ title: e.target.value })}
              />
            </label>
            <label>
              نشانک
              <input
                dir="ltr"
                value={editing.slug}
                onChange={(e) => patch({ slug: e.target.value })}
              />
            </label>
            <label>
              توضیح (اختیاری)
              <textarea
                rows={2}
                value={editing.description}
                onChange={(e) => patch({ description: e.target.value })}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={editing.isActive}
                onChange={(e) => patch({ isActive: e.target.checked })}
              />{" "}
              فعال باشد (خاموش کردن، QRهای چاپ‌شده را موقتا بی‌اثر می‌کند)
            </label>
          </div>

          <h4>لوگو</h4>
          <div className="logo-field">
            {editing.logoUrl && (
              <div className="logo-preview">
                <img src={editing.logoUrl} alt="" />
                <button type="button" onClick={() => patch({ logoUrl: "" })}>
                  حذف
                </button>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void upload(file, "logo");
                e.target.value = "";
              }}
            />
          </div>

          <h4>عکس‌های منو</h4>
          <p className="hint">
            اگر منوی چاپی دارید، عکسش را بگذارید. ترتیب نمایش، همین ترتیب است.
          </p>
          {editing.images.length > 0 && (
            <div className="menu-image-list">
              {editing.images.map((src, index) => (
                <div key={src} className="logo-preview">
                  <img src={src} alt="" />
                  <button
                    type="button"
                    onClick={() =>
                      patch({
                        images: editing.images.filter((_, i) => i !== index),
                      })
                    }
                  >
                    حذف
                  </button>
                </div>
              ))}
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file, "image");
              e.target.value = "";
            }}
          />

          <h4>فهرست قیمت</h4>
          {editing.sections.map((section, sIndex) => (
            <div key={section.id} className="menu-section-editor">
              <div className="menu-section-head">
                <input
                  placeholder="نام بخش، مثل: نوشیدنی گرم"
                  value={section.title}
                  onChange={(e) => {
                    const sections = [...editing.sections];
                    sections[sIndex] = { ...section, title: e.target.value };
                    patch({ sections });
                  }}
                />
                <button
                  type="button"
                  className="secondary"
                  style={{ width: "auto" }}
                  onClick={() =>
                    patch({
                      sections: editing.sections.filter((_, i) => i !== sIndex),
                    })
                  }
                >
                  حذف بخش
                </button>
              </div>

              {section.items.map((item, iIndex) => (
                <div key={item.id} className="menu-item-editor">
                  <input
                    placeholder="نام"
                    value={item.name}
                    onChange={(e) => {
                      const sections = [...editing.sections];
                      const items = [...section.items];
                      items[iIndex] = { ...item, name: e.target.value };
                      sections[sIndex] = { ...section, items };
                      patch({ sections });
                    }}
                  />
                  <input
                    placeholder="توضیح (اختیاری)"
                    value={item.description}
                    onChange={(e) => {
                      const sections = [...editing.sections];
                      const items = [...section.items];
                      items[iIndex] = { ...item, description: e.target.value };
                      sections[sIndex] = { ...section, items };
                      patch({ sections });
                    }}
                  />
                  <input
                    placeholder="قیمت"
                    value={item.price}
                    onChange={(e) => {
                      const sections = [...editing.sections];
                      const items = [...section.items];
                      items[iIndex] = { ...item, price: e.target.value };
                      sections[sIndex] = { ...section, items };
                      patch({ sections });
                    }}
                  />
                  <button
                    type="button"
                    className="secondary"
                    style={{ width: "auto" }}
                    onClick={() => {
                      const sections = [...editing.sections];
                      sections[sIndex] = {
                        ...section,
                        items: section.items.filter((_, i) => i !== iIndex),
                      };
                      patch({ sections });
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}

              <button
                type="button"
                className="secondary"
                style={{ width: "auto" }}
                onClick={() => {
                  const sections = [...editing.sections];
                  sections[sIndex] = {
                    ...section,
                    items: [
                      ...section.items,
                      { id: newId("i"), name: "", description: "", price: "" },
                    ],
                  };
                  patch({ sections });
                }}
              >
                + افزودن قلم
              </button>
            </div>
          ))}

          <button
            type="button"
            className="secondary"
            style={{ width: "auto" }}
            onClick={() =>
              patch({ sections: [...editing.sections, emptySection()] })
            }
          >
            + افزودن بخش
          </button>

          <h4>نشانی و QR</h4>
          <p className="hint">
            این کد را چاپ کنید و روی میز بگذارید. تا وقتی نشانک عوض نشود، همین
            کد معتبر می‌ماند — محتوای منو را هر وقت خواستید عوض کنید.
          </p>
          <div className="qr-row">
            <div
              className="qr-box"
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
            <div className="stack-form">
              <code dir="ltr" style={{ wordBreak: "break-all" }}>
                {publicUrl}
              </code>
              <button type="button" onClick={downloadQr}>
                دانلود QR (SVG، بدون افت کیفیت در چاپ)
              </button>
              <a
                className="button-like"
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                پیش‌نمایش منو
              </a>
            </div>
          </div>

          <div className="menu-actions">
            <button
              type="button"
              disabled={save.isPending}
              onClick={() => save.mutate(editing)}
            >
              {save.isPending ? "در حال ذخیره…" : "ذخیره‌ی منو"}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => setEditing(null)}
            >
              بستن
            </button>
            <button
              type="button"
              className="secondary"
              disabled={remove.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    `منوی «${editing.title}» حذف شود؟ QRهای چاپ‌شده دیگر کار نمی‌کنند.`,
                  )
                ) {
                  remove.mutate(editing.id);
                }
              }}
            >
              حذف منو
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
