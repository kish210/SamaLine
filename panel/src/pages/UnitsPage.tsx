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
            {unitForms.length === 0 ? (
              <p className="hint">فرمی ندارد.</p>
            ) : (
              <ul className="unit-links">
                {unitForms.map((f) => (
                  <li key={f.id}>
                    <Link to={`/forms/${f.id}`}>📝 {f.title}</Link>{" "}
                    <span className="hint">
                      ({FORM_STATUS[f.status] ?? f.status})
                    </span>
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
