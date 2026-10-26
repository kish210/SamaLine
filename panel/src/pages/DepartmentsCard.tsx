import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { FormEvent } from "react";
import { departmentsApi, describeError, teamApi } from "../api";
import type { Department } from "../types";

/**
 * بخش‌های پیشنهادیِ هتل.
 *
 * فقط برای پر کردن سریعِ فهرست‌اند؛ نام هر بخش بعدا قابل تغییر است و بخش
 * دلخواه هم می‌شود ساخت.
 */
const SUGGESTED: Array<{ key: string; name: string }> = [
  { key: "technical", name: "فنی و مهندسی" },
  { key: "housekeeping", name: "خانه‌داری" },
  { key: "hr", name: "منابع انسانی" },
  { key: "it", name: "فناوری اطلاعات" },
  { key: "contractors", name: "پیمانکاران" },
];

/**
 * بخش‌های سازمان و اعضایشان.
 *
 * فرمِ عملیاتی به یک بخش تعلق می‌گیرد و فقط اعضای همان بخش (و مدیران) آن را
 * می‌بینند و پر می‌کنند؛ این صفحه همان عضویت را می‌سازد.
 */
export function DepartmentsCard() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const departments = useQuery({
    queryKey: ["departments"],
    queryFn: departmentsApi.list,
  });

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["departments"] });

  const create = useMutation({
    mutationFn: (body: { name: string; key?: string }) =>
      departmentsApi.create(body),
    onSuccess: async () => {
      setError(null);
      setName("");
      await refresh();
    },
    onError: (err) => setError(describeError(err)),
  });

  const rename = useMutation({
    mutationFn: ({ id, next }: { id: string; next: string }) =>
      departmentsApi.rename(id, { name: next }),
    onSuccess: refresh,
    onError: (err) => setError(describeError(err)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => departmentsApi.remove(id),
    onSuccess: async () => {
      setOpenId(null);
      await refresh();
    },
    onError: (err) => setError(describeError(err)),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    create.mutate({ name: trimmed });
  };

  const existingKeys = new Set(
    (departments.data ?? []).map((d) => d.key).filter(Boolean),
  );
  const missing = SUGGESTED.filter((s) => !existingKeys.has(s.key));

  return (
    <section className="card">
      <div className="section-head">
        <h3>بخش‌های سازمان</h3>
      </div>

      <p className="hint">
        فرم‌های عملیاتی به یک بخش تعلق می‌گیرند و فقط اعضای همان بخش (و
        مدیران) آن‌ها را می‌بینند و پر می‌کنند. نظرسنجی‌های عمومی بخش ندارند.
      </p>

      {error && <p className="error">{error}</p>}

      <form className="inline-form" onSubmit={submit}>
        <input
          placeholder="نام بخش تازه"
          value={name}
          maxLength={120}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" disabled={create.isPending || !name.trim()}>
          افزودن بخش
        </button>
      </form>

      {missing.length > 0 && (
        <p className="hint">
          افزودن سریع:{" "}
          {missing.map((s) => (
            <button
              key={s.key}
              type="button"
              className="secondary chip-button"
              disabled={create.isPending}
              onClick={() => create.mutate({ name: s.name, key: s.key })}
            >
              + {s.name}
            </button>
          ))}
        </p>
      )}

      {departments.isLoading && <p>در حال بارگذاری…</p>}
      {departments.data?.length === 0 && (
        <p className="empty">هنوز بخشی تعریف نشده است.</p>
      )}

      <ul className="rule-list">
        {departments.data?.map((dept) => (
          <li key={dept.id}>
            <span>
              {dept.name}
              <small className="muted"> · {dept.memberCount ?? 0} عضو</small>
            </span>
            <span className="inline-form">
              <button
                type="button"
                className="secondary"
                onClick={() => setOpenId(openId === dept.id ? null : dept.id)}
              >
                {openId === dept.id ? "بستن" : "اعضا"}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  const next = window.prompt("نام تازه‌ی بخش", dept.name);
                  if (next && next.trim() && next.trim() !== dept.name) {
                    rename.mutate({ id: dept.id, next: next.trim() });
                  }
                }}
              >
                تغییر نام
              </button>
              <button
                type="button"
                className="danger"
                onClick={() => {
                  if (
                    window.confirm(
                      `بخش «${dept.name}» حذف شود؟ فرم‌های این بخش بی‌بخش (عمومی) می‌شوند.`,
                    )
                  ) {
                    remove.mutate(dept.id);
                  }
                }}
              >
                حذف
              </button>
            </span>
          </li>
        ))}
      </ul>

      {openId && <DepartmentMembers department={openId} onError={setError} />}
    </section>
  );
}

/** اعضای یک بخش: افزودن از میان اعضای تیم، و حذف. */
function DepartmentMembers({
  department,
  onError,
}: {
  department: string;
  onError: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState("");

  const members = useQuery({
    queryKey: ["department-members", department],
    queryFn: () => departmentsApi.members(department),
  });
  const team = useQuery({ queryKey: ["team-members"], queryFn: teamApi.members });

  const refresh = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["department-members", department],
    });
    await queryClient.invalidateQueries({ queryKey: ["departments"] });
  };

  const add = useMutation({
    mutationFn: (id: string) => departmentsApi.addMember(department, id),
    onSuccess: async () => {
      setUserId("");
      await refresh();
    },
    onError: (err) => onError(describeError(err)),
  });

  const drop = useMutation({
    mutationFn: (id: string) => departmentsApi.removeMember(department, id),
    onSuccess: refresh,
    onError: (err) => onError(describeError(err)),
  });

  // کسانی که هنوز عضو این بخش نیستند؛ وگرنه افزودن تکراری پیشنهاد می‌شد.
  const inDept = new Set((members.data ?? []).map((m) => m.userId));
  const candidates = (team.data ?? []).filter((m) => !inDept.has(m.userId));

  return (
    <div className="card nested">
      <h4>اعضای بخش</h4>

      {members.data?.length === 0 && (
        <p className="empty">هنوز کسی در این بخش نیست.</p>
      )}

      <ul className="rule-list">
        {members.data?.map((m) => (
          <li key={m.id}>
            <span>
              {m.fullName || m.email}
              <small className="muted"> · {m.email}</small>
            </span>
            <button
              type="button"
              className="secondary"
              onClick={() => drop.mutate(m.userId)}
            >
              حذف از بخش
            </button>
          </li>
        ))}
      </ul>

      <div className="inline-form">
        <select value={userId} onChange={(e) => setUserId(e.target.value)}>
          <option value="">افزودن عضو…</option>
          {candidates.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.fullName || m.email} ({m.email})
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!userId || add.isPending}
          onClick={() => add.mutate(userId)}
        >
          افزودن
        </button>
      </div>
    </div>
  );
}

export type { Department };
