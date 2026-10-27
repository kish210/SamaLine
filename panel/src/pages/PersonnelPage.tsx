import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { departmentsApi, describeError, hrApi } from "../api";
import type { Personnel } from "../api";
import { useAuth } from "../auth";
import { hasRole } from "../types";

/**
 * پروندهٔ پرسنل به‌عنوان داده‌ی پایهٔ HR (فاز E).
 *
 * شماره موبایل کلیدِ اتصال به ربات بله در فاز F است؛ وقتی اینجا ثبت شد، همان
 * پرسنل بعدا می‌تواند از بله واردِ پورتالِ خودش شود.
 */
export function PersonnelPage() {
  const queryClient = useQueryClient();
  const me = useAuth((s) => s.user);
  const canEdit = hasRole(me?.role ?? null, "admin");

  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [employeeNo, setEmployeeNo] = useState("");
  const [position, setPosition] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [hireDate, setHireDate] = useState("");
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [annTitle, setAnnTitle] = useState("");
  const [annBody, setAnnBody] = useState("");
  const [annDept, setAnnDept] = useState("");
  const [annResult, setAnnResult] = useState<string | null>(null);

  const people = useQuery({ queryKey: ["personnel"], queryFn: hrApi.list });
  const departments = useQuery({
    queryKey: ["departments"],
    queryFn: departmentsApi.list,
  });
  const announcements = useQuery({
    queryKey: ["announcements"],
    queryFn: hrApi.announcements,
  });

  const deptName = useMemo(() => {
    const map = new Map<string, string>();
    for (const d of departments.data ?? []) map.set(d.id, d.name);
    return map;
  }, [departments.data]);

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["personnel"] });

  const create = useMutation({
    mutationFn: () =>
      hrApi.create({
        fullName: fullName.trim(),
        mobile: mobile.trim(),
        employeeNo: employeeNo.trim(),
        position: position.trim(),
        departmentId: departmentId || null,
        hireDate: hireDate.trim(),
      }),
    onSuccess: async () => {
      setError(null);
      setFullName("");
      setMobile("");
      setEmployeeNo("");
      setPosition("");
      setHireDate("");
      await refresh();
    },
    onError: (err) => setError(describeError(err)),
  });

  const toggleActive = useMutation({
    mutationFn: (p: Personnel) =>
      hrApi.update(p.id, { isActive: !p.isActive }),
    onSuccess: refresh,
    onError: (err) => setError(describeError(err)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => hrApi.remove(id),
    onSuccess: refresh,
    onError: (err) => setError(describeError(err)),
  });

  const announce = useMutation({
    mutationFn: () =>
      hrApi.announce({
        title: annTitle.trim(),
        body: annBody.trim(),
        departmentId: annDept || null,
      }),
    onSuccess: async (res) => {
      setAnnResult(
        `به ${res.sent} پرسنل ارسال شد${res.skipped ? ` (${res.skipped} ناموفق)` : ""}.`,
      );
      setAnnTitle("");
      setAnnBody("");
      await queryClient.invalidateQueries({ queryKey: ["announcements"] });
    },
    onError: (err) => setAnnResult(describeError(err)),
  });

  const sendAnnouncement = (event: FormEvent) => {
    event.preventDefault();
    setAnnResult(null);
    if (annTitle.trim() && annBody.trim()) announce.mutate();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (fullName.trim()) create.mutate();
  };

  const filtered = useMemo(() => {
    const needle = filter.trim();
    const list = people.data ?? [];
    if (!needle) return list;
    return list.filter(
      (p) =>
        p.fullName.includes(needle) ||
        p.mobile.includes(needle) ||
        p.position.includes(needle) ||
        p.employeeNo.includes(needle),
    );
  }, [people.data, filter]);

  return (
    <div className="page">
      <header className="page-header">
        <h1>پرسنل</h1>
      </header>

      {error && <p className="error">{error}</p>}

      {canEdit && (
        <section className="card">
          <form className="inline-form" onSubmit={submit}>
            <input
              placeholder="نام و نام خانوادگی"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
            <input
              placeholder="موبایل (کلیدِ بله)"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              style={{ maxWidth: 160 }}
            />
            <input
              placeholder="کد پرسنلی"
              value={employeeNo}
              onChange={(e) => setEmployeeNo(e.target.value)}
              style={{ maxWidth: 120 }}
            />
            <input
              placeholder="سمت"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              style={{ maxWidth: 140 }}
            />
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
            >
              <option value="">بدون بخش</option>
              {(departments.data ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              title="تاریخ استخدام"
              value={hireDate}
              onChange={(e) => setHireDate(e.target.value)}
              style={{ maxWidth: 150 }}
            />
            <button type="submit" disabled={create.isPending || !fullName.trim()}>
              افزودن پرسنل
            </button>
          </form>
        </section>
      )}

      {canEdit && (
        <section className="card">
          <h3>اطلاعیه به ربات پرسنل</h3>
          <p className="hint">
            به گفتگوی بله/تلگرامِ پرسنلی می‌رود که با شماره موبایل به ربات وصل
            شده‌اند.
          </p>
          <form className="announce-form" onSubmit={sendAnnouncement}>
            <input
              placeholder="عنوان اطلاعیه"
              value={annTitle}
              onChange={(e) => setAnnTitle(e.target.value)}
            />
            <textarea
              placeholder="متن اطلاعیه…"
              rows={3}
              value={annBody}
              onChange={(e) => setAnnBody(e.target.value)}
            />
            <div className="announce-actions">
              <select
                value={annDept}
                onChange={(e) => setAnnDept(e.target.value)}
              >
                <option value="">همهٔ پرسنل</option>
                {(departments.data ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    فقط {d.name}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={
                  announce.isPending || !annTitle.trim() || !annBody.trim()
                }
              >
                ارسال اطلاعیه
              </button>
            </div>
          </form>
          {annResult && <p className="hint">{annResult}</p>}

          {(announcements.data?.length ?? 0) > 0 && (
            <ul className="announce-history">
              {(announcements.data ?? []).map((a) => (
                <li key={a.id}>
                  <div className="announce-row">
                    <strong>{a.title}</strong>
                    <span className="hint">
                      {new Date(a.createdAt).toLocaleDateString("fa-IR")} ·{" "}
                      {a.recipientCount} گیرنده
                      {a.departmentId
                        ? ` · ${deptName.get(a.departmentId) ?? "بخش"}`
                        : ""}
                    </span>
                  </div>
                  <p className="announce-body">{a.body}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="card">
        <div className="section-head">
          <h3>{people.data?.length ?? 0} پرسنل</h3>
          <input
            className="table-search"
            placeholder="جستجوی نام، موبایل، سمت…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>

        {people.isLoading && <p>در حال بارگذاری…</p>}
        {people.data?.length === 0 && (
          <p className="empty">هنوز پرسنلی ثبت نشده.</p>
        )}

        {filtered.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>نام</th>
                <th>موبایل</th>
                <th>سمت</th>
                <th>بخش</th>
                <th>ربات</th>
                <th>وضعیت</th>
                {canEdit && <th></th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className={p.isActive ? "" : "row-off"}>
                  <td>{p.fullName}</td>
                  <td dir="ltr" style={{ textAlign: "right" }}>
                    {p.mobile || "—"}
                  </td>
                  <td>{p.position || "—"}</td>
                  <td>{p.departmentId ? deptName.get(p.departmentId) ?? "—" : "—"}</td>
                  <td>
                    {p.botChatId ? (
                      <span className="review-badge approved" title={p.botPlatform}>
                        متصل
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    {canEdit ? (
                      <button
                        type="button"
                        className="link-btn"
                        onClick={() => toggleActive.mutate(p)}
                      >
                        {p.isActive ? "فعال" : "غیرفعال"}
                      </button>
                    ) : p.isActive ? (
                      "فعال"
                    ) : (
                      "غیرفعال"
                    )}
                  </td>
                  {canEdit && (
                    <td>
                      <button
                        type="button"
                        className="room-del"
                        title="حذف پرسنل"
                        onClick={() => {
                          if (window.confirm(`پروندهٔ ${p.fullName} حذف شود؟`)) {
                            remove.mutate(p.id);
                          }
                        }}
                      >
                        ×
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
