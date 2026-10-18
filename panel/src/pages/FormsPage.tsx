import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { describeError, formsApi, reportsApi, workspaceApi } from "../api";
import type { FormTemplateSummary } from "../api";
import { TemplatePicker } from "./TemplatePicker";
import type { FormPage } from "../types";

const STATUS_LABELS: Record<string, string> = {
  draft: "پیش‌نویس",
  active: "فعال",
  closed: "بسته",
  archived: "بایگانی",
};

/** یک صفحه‌ی خالی با یک سوال، تا فرم تازه بلافاصله قابل ویرایش باشد. */
const starterPages = (): FormPage[] => [
  {
    id: "p1",
    title: "صفحه ۱",
    questions: [
      { id: "q1", type: "short_text", title: "سوال اول شما", required: false },
    ],
  },
];

export function FormsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  /*
   * آیا عنوان را کاربر خودش نوشته؟ اگر نه، انتخاب قالب عنوان قالب را جای
   * آن می‌گذارد تا لازم نباشد برای ساخت از قالب اول چیزی تایپ شود.
   */
  const [titleEdited, setTitleEdited] = useState(false);
  const [templateKey, setTemplateKey] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [deleting, setDeleting] = useState<{
    id: string;
    title: string;
  } | null>(null);

  const workspaces = useQuery({
    queryKey: ["workspaces"],
    queryFn: workspaceApi.list,
  });
  const workspaceId = workspaces.data?.[0]?.id ?? "";

  const forms = useQuery({
    queryKey: ["forms", workspaceId, showArchived],
    queryFn: () => formsApi.list(workspaceId, showArchived),
    enabled: Boolean(workspaceId),
  });

  const refreshForms = () =>
    void queryClient.invalidateQueries({ queryKey: ["forms"] });

  const setArchived = useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      formsApi.setArchived(id, archived),
    onSuccess: refreshForms,
    onError: (err) => setError(describeError(err)),
  });

  const createForm = useMutation({
    mutationFn: () =>
      formsApi.create({
        workspaceId,
        title,
        // اسلاگ یکتا بدون نیاز به ورودی کاربر.
        slug: `form-${Date.now().toString(36)}`,
        // با قالب، ساختار سمت سرور باز می‌شود؛ بدون قالب، فرم ساده‌ی محلی.
        ...(templateKey ? { templateKey } : { pages: starterPages() }),
      }),
    onSuccess: async (created) => {
      /*
       * اگر پلن سازمان بخشی از قالب را نداشته باشد (منطق شرطی، شاخص،
       * چندزبانه)، فرم ساخته می‌شود ولی بدون آن بخش؛ کاربر باید بداند چه
       * چیزی کم است، نه اینکه بعدا تعجب کند.
       */
      if (created.planSkipped?.length) {
        window.alert(
          `فرم ساخته شد، ولی این بخش‌های قالب در پلن فعلی شما نیست و اعمال نشد:\n${created.planSkipped.join("، ")}`,
        );
      }
      setTitle("");
      setTitleEdited(false);
      setTemplateKey("");
      setPickerOpen(false);
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["forms", workspaceId] });
      // فرم تازه مستقیم در فرم‌ساز باز می‌شود؛ قدم بعدی کاربر همیشه ویرایش است.
      navigate(`/forms/${created.id}`);
    },
    onError: (err) => setError(describeError(err)),
  });

  const create = () => {
    if (!workspaceId || !title.trim() || createForm.isPending) return;
    createForm.mutate();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    create();
  };

  const chooseTemplate = (template: FormTemplateSummary) => {
    setTemplateKey(template.key);
    if (!titleEdited) {
      setTitle(template.key === "blank" ? "" : template.title);
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <h1>فرم‌ها</h1>
        <form className="inline-form" onSubmit={submit}>
          <input
            placeholder="عنوان فرم جدید"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setTitleEdited(e.target.value.trim().length > 0);
            }}
          />
          <button
            type="button"
            className="secondary"
            onClick={() => setPickerOpen((open) => !open)}
          >
            {pickerOpen ? "بستن قالب‌ها" : "انتخاب از قالب"}
          </button>
          <button type="submit" disabled={createForm.isPending || !workspaceId}>
            ساخت فرم
          </button>
        </form>
      </header>

      {pickerOpen && (
        <section className="card">
          <TemplatePicker
            value={templateKey}
            onChange={chooseTemplate}
            onCreate={title.trim() ? create : undefined}
            creating={createForm.isPending}
          />
        </section>
      )}

      {error && <p className="error">{error}</p>}

      {forms.isLoading && <p>در حال بارگذاری…</p>}

      {forms.data?.length === 0 && (
        <p className="empty">هنوز فرمی نساخته‌اید. اولین فرم را بسازید.</p>
      )}

      <label className="checkbox">
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(e) => setShowArchived(e.target.checked)}
        />
        نمایش فرم‌های بایگانی‌شده
      </label>

      <div className="card-grid">
        {forms.data?.map((form) => (
          <div key={form.id} className="card form-card">
            <Link to={`/forms/${form.id}`}>
              <h3>{form.title}</h3>
              <div className="meta">
                <span className={`badge badge-${form.status}`}>
                  {STATUS_LABELS[form.status] ?? form.status}
                </span>
                <span className="form-card-stats">
                  {describeResponses(form.responseCount, form.lastResponseAt)}
                </span>
              </div>
            </Link>

            <div className="form-card-actions">
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  setArchived.mutate({
                    id: form.id,
                    archived: form.status !== "archived",
                  })
                }
              >
                {form.status === "archived" ? "بازگرداندن" : "بایگانی"}
              </button>
              {form.status === "archived" && (
                <button
                  type="button"
                  className="danger"
                  onClick={() => setDeleting(form)}
                >
                  حذف همیشگی
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {deleting && (
        <DeleteFormDialog
          form={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setDeleting(null);
            refreshForms();
          }}
        />
      )}
    </div>
  );
}

interface DeleteDialogProps {
  form: { id: string; title: string };
  onClose: () => void;
  onDeleted: () => void;
}

/**
 * تایید حذف همیشگی فرم.
 *
 * تعداد پاسخ‌ها همین‌جا و همین حالا از سرور خوانده می‌شود، نه از فهرست
 * فرم‌ها که ممکن است چند دقیقه پیش گرفته شده باشد. سرور هم همین عدد را
 * دوباره می‌سنجد و اگر در این فاصله پاسخ تازه‌ای آمده باشد حذف را رد
 * می‌کند — پس هیچ‌وقت داده‌ای که کاربر از وجودش خبر نداشته نابود نمی‌شود.
 */
function DeleteFormDialog({ form, onClose, onDeleted }: DeleteDialogProps) {
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState("");

  const summary = useQuery({
    queryKey: ["summary", form.id],
    queryFn: () => reportsApi.summary(form.id),
  });

  /*
   * «شروع‌شده» همان تعداد کلِ پاسخ‌نامه‌هاست (کامل و ناتمام)، و سرور هم
   * دقیقا همین را می‌شمارد؛ پس عددی که کاربر تایید می‌کند با عددی که سرور
   * می‌سنجد یکی است.
   */
  const responses = summary.data ? summary.data.started : null;

  const remove = useMutation({
    mutationFn: () => formsApi.remove(form.id, responses ?? -1),
    onSuccess: onDeleted,
    onError: (err) => setError(describeError(err)),
  });

  return (
    <section className="card delete-dialog">
      <h3>حذف همیشگی «{form.title}»</h3>

      {summary.isLoading ? (
        <p>در حال خواندن تعداد پاسخ‌ها…</p>
      ) : (
        <p className="error">
          این کار برگشت‌ناپذیر است. فرم، ساختار، لینک‌ها و{" "}
          <b>{responses ?? 0} پاسخ ثبت‌شده</b> برای همیشه پاک می‌شوند.
        </p>
      )}

      <label>
        <span className="field-label">
          برای تایید، عنوان فرم را دقیقا بنویسید
        </span>
        <input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={form.title}
        />
      </label>

      {error && <p className="error">{error}</p>}

      <div className="inline-form">
        <button
          type="button"
          className="danger"
          disabled={
            confirmText.trim() !== form.title.trim() ||
            responses === null ||
            remove.isPending
          }
          onClick={() => remove.mutate()}
        >
          {remove.isPending ? "در حال حذف…" : "حذف همیشگی"}
        </button>
        <button type="button" className="secondary" onClick={onClose}>
          انصراف
        </button>
      </div>
    </section>
  );
}

/**
 * خلاصه‌ی پاسخ‌های کارت فرم: «۱۲ پاسخ، آخرین: ۱۴۰۵/۷/۷».
 *
 * پیش از این نشانک داخلی فرم (مثل `hotel-1790657206382`) نمایش داده می‌شد
 * که برای کاربر معنایی نداشت.
 */
function describeResponses(
  count: number | undefined,
  lastAt: string | null | undefined,
): string {
  if (!count) return "هنوز پاسخی نیامده";
  const total = `${count.toLocaleString("fa-IR")} پاسخ`;
  if (!lastAt) return total;
  const date = new Date(lastAt).toLocaleDateString("fa-IR");
  return `${total}، آخرین: ${date}`;
}
