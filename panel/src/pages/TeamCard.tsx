import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { FormEvent } from "react";
import { describeError, teamApi } from "../api";
import { useAuth } from "../auth";
import { ROLE_LABELS, hasRole } from "../types";
import type { OrganizationRole } from "../types";

const INVITABLE: OrganizationRole[] = ["admin", "editor", "analyst", "viewer"];
const ASSIGNABLE: OrganizationRole[] = [
  "owner",
  "admin",
  "editor",
  "analyst",
  "viewer",
];

const ROLE_HINTS: Record<OrganizationRole, string> = {
  owner: "همه‌چیز، از جمله دادن و گرفتن نقش مالک",
  admin: "تیم، کلید API، وبهوک، تلگرام و همه‌ی کارهای ویرایشگر",
  editor: "ساخت، ویرایش و انتشار فرم، کمپین و مخاطبان",
  analyst: "گزارش، داشبورد، خروجی اکسل و یادداشت روی پاسخ‌نامه",
  viewer: "فقط دیدن فرم‌ها و گزارش‌ها",
};

const fa = (date: string) => new Date(date).toLocaleDateString("fa-IR");

/**
 * تیم سازمان: اعضا، نقش‌ها و دعوت‌نامه‌ها.
 *
 * لینک دعوت پس از ساخت نشان داده می‌شود تا اگر ایمیل تنظیم نشده باشد (یا به
 * اسپم رفته باشد) بشود همان را دستی فرستاد؛ این لینک دیگر قابل بازیابی نیست،
 * پس تا ساخت دعوت بعدی روی صفحه می‌ماند.
 */
export function TeamCard() {
  const queryClient = useQueryClient();
  const me = useAuth((s) => s.user);
  const myRole = me?.role ?? null;

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrganizationRole>("editor");
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<{ email: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const members = useQuery({
    queryKey: ["team-members"],
    queryFn: teamApi.members,
  });
  const invitations = useQuery({
    queryKey: ["team-invitations"],
    queryFn: teamApi.invitations,
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["team-members"] }),
      queryClient.invalidateQueries({ queryKey: ["team-invitations"] }),
    ]);
  };

  const invite = useMutation({
    mutationFn: () => teamApi.invite(email.trim(), role),
    onSuccess: async (result) => {
      setEmail("");
      setError(null);
      setCopied(false);
      setLink({ email: result.email, url: result.link });
      await refresh();
    },
    onError: (err) => setError(describeError(err)),
  });

  const changeRole = useMutation({
    mutationFn: (input: { id: string; role: OrganizationRole }) =>
      teamApi.changeRole(input.id, input.role),
    onSuccess: async () => {
      setError(null);
      await refresh();
    },
    onError: (err) => setError(describeError(err)),
  });

  const removeMember = useMutation({
    mutationFn: teamApi.removeMember,
    onSuccess: async () => {
      setError(null);
      await refresh();
    },
    onError: (err) => setError(describeError(err)),
  });

  const revoke = useMutation({
    mutationFn: teamApi.revokeInvitation,
    onSuccess: refresh,
    onError: (err) => setError(describeError(err)),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    invite.mutate();
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
    } catch {
      // بدون اجازه‌ی کلیپ‌بورد، کاربر لینک را از روی صفحه دستی برمی‌دارد.
      setCopied(false);
    }
  };

  const isOwner = myRole === "owner";
  const pending = invitations.data ?? [];

  return (
    <section className="card">
      <h3>تیم</h3>
      <p className="hint">
        هم‌تیمی‌ها با حساب خودشان وارد می‌شوند و فقط کارهای نقششان را می‌توانند
        انجام دهند. لینک دعوت ۷ روز و فقط یک بار معتبر است.
      </p>

      {members.data && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>نام</th>
                <th>ایمیل</th>
                <th>نقش</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {members.data.map((member) => {
                const self = member.userId === me?.id;
                // مالک را فقط مالک جابه‌جا می‌کند؛ سرور هم همین را می‌گوید.
                const locked = member.role === "owner" && !isOwner;
                return (
                  <tr key={member.id}>
                    <td>
                      {member.fullName}
                      {self && <span className="chip-count"> (شما)</span>}
                    </td>
                    <td dir="ltr">{member.email}</td>
                    <td>
                      <select
                        aria-label={`نقش ${member.fullName}`}
                        value={member.role}
                        disabled={locked || changeRole.isPending}
                        onChange={(e) =>
                          changeRole.mutate({
                            id: member.id,
                            role: e.target.value as OrganizationRole,
                          })
                        }
                      >
                        {ASSIGNABLE.filter(
                          (value) => value !== "owner" || isOwner,
                        ).map((value) => (
                          <option key={value} value={value}>
                            {ROLE_LABELS[value]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {!self && !locked && (
                        <button
                          type="button"
                          className="secondary"
                          style={{ width: "auto" }}
                          disabled={removeMember.isPending}
                          onClick={() => {
                            if (
                              window.confirm(
                                `${member.fullName} از تیم حذف شود؟ دسترسی‌اش بی‌درنگ قطع می‌شود.`,
                              )
                            ) {
                              removeMember.mutate(member.id);
                            }
                          }}
                        >
                          حذف
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pending.length > 0 && (
        <>
          <h4>دعوت‌های در انتظار</h4>
          <div className="table-scroll">
            <table>
              <tbody>
                {pending.map((invitation) => (
                  <tr key={invitation.id}>
                    <td dir="ltr">{invitation.email}</td>
                    <td>{ROLE_LABELS[invitation.role]}</td>
                    <td>تا {fa(invitation.expiresAt)}</td>
                    <td>
                      <button
                        type="button"
                        className="secondary"
                        style={{ width: "auto" }}
                        disabled={revoke.isPending}
                        onClick={() => revoke.mutate(invitation.id)}
                      >
                        لغو
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <form onSubmit={submit} className="stack-form">
        <label>
          ایمیل هم‌تیمی
          <input
            type="email"
            dir="ltr"
            required
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          نقش
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as OrganizationRole)}
          >
            {INVITABLE.map((value) => (
              <option key={value} value={value}>
                {ROLE_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <p className="hint">{ROLE_HINTS[role]}</p>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={invite.isPending}>
          {invite.isPending ? "در حال فرستادن…" : "فرستادن دعوت"}
        </button>
      </form>

      {link && (
        <div className="template-selected">
          <span>
            لینک دعوت <strong dir="ltr">{link.email}</strong> به ایمیلش فرستاده
            شد. اگر نرسید، همین لینک را دستی بفرستید؛ بعد از بستن این صفحه دیگر
            نشان داده نمی‌شود:
            <br />
            <code dir="ltr" style={{ wordBreak: "break-all" }}>
              {link.url}
            </code>
          </span>
          <button type="button" onClick={copy}>
            {copied ? "کپی شد" : "کپی لینک"}
          </button>
        </div>
      )}

      {!hasRole(myRole, "admin") && (
        <p className="hint">این بخش فقط برای مالک و مدیر سازمان است.</p>
      )}
    </section>
  );
}
