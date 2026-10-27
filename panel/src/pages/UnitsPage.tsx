import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  dashboardsApi,
  departmentsApi,
  describeError,
  formsApi,
  hotelSetupApi,
  workspaceApi,
} from "../api";
import { useAuth } from "../auth";
import { hasRole } from "../types";
import type { FormSummary } from "../types";
import { formUrl } from "../renderer-url";

const FORM_STATUS: Record<string, string> = {
  draft: "پیش‌نویس",
  active: "فعال",
  closed: "بسته",
  archived: "بایگانی",
};

/**
 * واحدهای هتل: هر بخش (فنی، خانه‌داری، …) با فرم‌ها و داشبوردِ خودش، یک‌جا.
 *
 * پیش از این بخش‌ها فقط در «تنظیمات» ساخته می‌شدند و در سامانه دیده نمی‌شدند؛
 * سازمانی که بخشی نساخته بود نه «بخشِ فنی» داشت نه داشبوردِ واحد. دکمه‌ی
 * راه‌اندازی، واحدهای استاندارد را با فرمِ عملیاتی و داشبوردشان می‌سازد.
 */
export function UnitsPage() {
  const queryClient = useQueryClient();
  const me = useAuth((s) => s.user);
  const canSetup = hasRole(me?.role ?? null, "admin");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const workspaces = useQuery({
    queryKey: ["workspaces"],
    queryFn: workspaceApi.list,
  });
  const workspaceId = workspaces.data?.[0]?.id ?? "";

  const departments = useQuery({
    queryKey: ["departments"],
    queryFn: departmentsApi.list,
  });
  const forms = useQuery({
    queryKey: ["forms", workspaceId],
    queryFn: () => formsApi.list(workspaceId),
    enabled: Boolean(workspaceId),
  });
  const dashboards = useQuery({
    queryKey: ["dashboards"],
    queryFn: dashboardsApi.list,
  });

  const setup = useMutation({
    mutationFn: () => hotelSetupApi.standardUnits(workspaceId),
    onSuccess: async (result) => {
      setError(null);
      const made = result.filter(
        (r) =>
          r.department === "created" ||
          r.form === "created" ||
          r.dashboard === "created",
      ).length;
      const skipped = result.filter((r) => r.form === "skipped");
      setMessage(
        made
          ? `${made} واحد راه‌اندازی/تکمیل شد.` +
              (skipped.length
                ? ` فرمِ ${skipped.map((s) => s.name).join("، ")} ساخته نشد (${skipped[0].note ?? ""}).`
                : "")
          : "همه‌ی واحدهای استاندارد از قبل آماده بودند.",
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["departments"] }),
        queryClient.invalidateQueries({ queryKey: ["forms", workspaceId] }),
        queryClient.invalidateQueries({ queryKey: ["dashboards"] }),
      ]);
    },
    onError: (err) => setError(describeError(err)),
  });

  /** لینکِ کارکنانِ هر فرم، پس از فعال‌سازی یا درخواستِ نمایش. */
  const [links, setLinks] = useState<Record<string, string>>({});
  const canPublish = hasRole(me?.role ?? null, "editor");

  /*
   * فعال‌سازیِ فرمِ واحد برای کارکنان: فرم فعال و لینکش ساخته می‌شود و احرازِ
   * «کارمند» روی آن می‌نشیند (فقط کارمندِ واردشده‌ی همین بخش یا مدیر پر می‌کند).
   * برای فرمِ از قبل فعال فقط لینک گرفته می‌شود و حالتِ احرازش دست نمی‌خورد —
   * publishLink تکرارپذیر است و همان انتشارِ موجود را برمی‌گرداند.
   */
  const activate = useMutation({
    mutationFn: async (form: FormSummary) => {
      const publication = await formsApi.publishLink(form.id);
      if (form.status !== "active") {
        await formsApi.setAuthMode(form.id, "staff");
      }
      return { formId: form.id, url: formUrl(publication.slug ?? publication.token) };
    },
    onSuccess: async ({ formId, url }) => {
      setError(null);
      setLinks((current) => ({ ...current, [formId]: url }));
      await queryClient.invalidateQueries({ queryKey: ["forms", workspaceId] });
    },
    onError: (err) => setError(describeError(err)),
  });

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setMessage("لینک کپی شد.");
    } catch {
      window.prompt("لینک را کپی کنید:", url);
    }
  };

  const units = useMemo(
    () =>
      (departments.data ?? []).map((dept) => ({
        dept,
        forms: (forms.data ?? []).filter((f) => f.departmentId === dept.id),
        dashboards: (dashboards.data ?? []).filter(
          (d) => d.departmentId === dept.id,
        ),
      })),
    [departments.data, forms.data, dashboards.data],
  );

  return (
    <div className="page">
      <header className="page-header">
        <h1>واحدهای هتل</h1>
        {canSetup && (
          <button
            type="button"
            disabled={!workspaceId || setup.isPending}
            onClick={() => setup.mutate()}
          >
            {setup.isPending
              ? "در حال راه‌اندازی…"
              : "راه‌اندازیِ واحدهای استانداردِ هتل"}
          </button>
        )}
      </header>

      {error && <p className="error">{error}</p>}
      {message && <p className="hint">{message}</p>}

      {departments.isLoading && <p>در حال بارگذاری…</p>}
      {departments.data?.length === 0 && (
        <section className="card">
          <p className="empty">
            هنوز واحدی تعریف نشده.{" "}
            {canSetup
              ? "با دکمه‌ی بالا، واحدهای فنی، خانه‌داری، منابع انسانی، IT و پیمانکاران با فرمِ عملیاتی و داشبوردشان ساخته می‌شوند."
              : "از مدیرِ سامانه بخواهید واحدها را راه‌اندازی کند."}
          </p>
        </section>
      )}

      <div className="unit-grid">
        {units.map(({ dept, forms: unitForms, dashboards: unitDashboards }) => (
          <section key={dept.id} className="card unit-card">
            <div className="section-head">
              <h3>{dept.name}</h3>
              <span className="hint">
                {(dept.memberCount ?? 0).toLocaleString("fa-IR")} عضو
              </span>
            </div>

            <h4>داشبورد</h4>
            {unitDashboards.length === 0 ? (
              <p className="hint">داشبوردی ندارد.</p>
            ) : (
              <ul className="unit-links">
                {unitDashboards.map((d) => (
                  <li key={d.id}>
                    <Link to={`/dashboards?id=${d.id}`}>📊 {d.name}</Link>
                  </li>
                ))}
              </ul>
            )}

            <h4>فرم‌ها</h4>
            {(dept.memberCount ?? 0) === 0 && unitForms.length > 0 && (
              <p className="hint">
                این واحد هنوز عضوی ندارد؛ فرمِ «کارمند» را فعلا فقط مدیران پر
                می‌کنند. عضوها را از «تنظیمات ← بخش‌ها» اضافه کنید.
              </p>
            )}
            {unitForms.length === 0 ? (
              <p className="hint">فرمی ندارد.</p>
            ) : (
              <ul className="unit-links">
                {unitForms.map((f) => (
                  <li key={f.id}>
                    <Link to={`/forms/${f.id}`}>📝 {f.title}</Link>{" "}
                    <span className="hint">
                      ({FORM_STATUS[f.status] ?? f.status}
                      {f.responseCount
                        ? ` · ${f.responseCount.toLocaleString("fa-IR")} گزارش`
                        : ""}
                      )
                    </span>
                    {canPublish && f.status !== "archived" && (
                      <div className="unit-actions">
                        <button
                          type="button"
                          className={f.status === "active" ? "secondary" : ""}
                          disabled={activate.isPending}
                          onClick={() => activate.mutate(f)}
                        >
                          {f.status === "active"
                            ? "لینکِ کارکنان"
                            : "فعال‌سازی برای کارکنان"}
                        </button>
                        {links[f.id] && (
                          <>
                            <code dir="ltr" className="unit-link">
                              {links[f.id]}
                            </code>
                            <button
                              type="button"
                              className="secondary"
                              onClick={() => void copy(links[f.id])}
                            >
                              کپی
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
