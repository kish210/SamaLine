import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { FormEvent } from "react";
import { apiKeysApi, describeError } from "../api";
import { ROLE_LABELS } from "../types";
import type { OrganizationRole } from "../types";

const KEY_ROLES: OrganizationRole[] = ["admin", "editor", "analyst", "viewer"];

const fa = (date: string | null) =>
  date ? new Date(date).toLocaleDateString("fa-IR") : "—";

/**
 * کلید API برای برنامه‌های بیرونی.
 *
 * کلید مثل یک عضو ماشینی تیم است: نقش دارد و همان محدودیت‌های آن نقش را
 * می‌گیرد. مسیرهای حساب و مالکیت سازمان (رمز، تیم، فاکتور و خودِ کلیدها)
 * برای کلید بسته‌اند، پس کلید لو رفته نمی‌تواند سازمان را تصاحب کند.
 */
export function ApiKeysCard() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [role, setRole] = useState<OrganizationRole>("viewer");
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<{ name: string; key: string } | null>(
    null,
  );
  const [copied, setCopied] = useState(false);

  const keys = useQuery({ queryKey: ["api-keys"], queryFn: apiKeysApi.list });
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["api-keys"] });

  const create = useMutation({
    mutationFn: () =>
      apiKeysApi.create({
        name: name.trim(),
        role,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
      }),
    onSuccess: async (created) => {
      setName("");
      setExpiresAt("");
      setError(null);
      setCopied(false);
      setFresh({ name: created.name, key: created.apiKey });
      await refresh();
    },
    onError: (err) => setError(describeError(err)),
  });

  const revoke = useMutation({
    mutationFn: apiKeysApi.revoke,
    onSuccess: refresh,
    onError: (err) => setError(describeError(err)),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    create.mutate();
  };

  const copy = async () => {
    if (!fresh) return;
    try {
      await navigator.clipboard.writeText(fresh.key);
      setCopied(true);
    } catch {
      // بدون اجازه‌ی کلیپ‌بورد، کاربر کلید را از روی صفحه برمی‌دارد.
      setCopied(false);
    }
  };

  const active = (keys.data ?? []).filter((key) => key.isActive);

  return (
    <section className="card">
      <h3>کلید API</h3>
      <p className="hint">
        برای وصل کردن برنامه‌های خودتان به سامانه. کلید را در سربرگ{" "}
        <code dir="ltr">X-API-Key</code> بفرستید (یا{" "}
        <code dir="ltr">Authorization: Bearer sl_…</code>). هر کلید نقش خودش را
        دارد و بیشتر از آن نمی‌تواند کاری کند؛ رمز، تیم، فاکتور و ساخت کلید تازه
        با کلید API در دسترس نیستند.
      </p>

      {active.length > 0 && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>نام</th>
                <th>پیشوند</th>
                <th>نقش</th>
                <th>آخرین استفاده</th>
                <th>انقضا</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {active.map((key) => (
                <tr key={key.id}>
                  <td>{key.name}</td>
                  <td dir="ltr">
                    <code>{key.keyPrefix}…</code>
                  </td>
                  <td>{ROLE_LABELS[key.role]}</td>
                  <td>{fa(key.lastUsedAt)}</td>
                  <td>{fa(key.expiresAt)}</td>
                  <td>
                    <button
                      type="button"
                      className="secondary"
                      style={{ width: "auto" }}
                      disabled={revoke.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            `کلید «${key.name}» باطل شود؟ برنامه‌ای که از آن استفاده می‌کند بی‌درنگ قطع می‌شود.`,
                          )
                        ) {
                          revoke.mutate(key.id);
                        }
                      }}
                    >
                      ابطال
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form onSubmit={submit} className="stack-form">
        <label>
          نام کلید (برای یادآوری اینکه کجا استفاده می‌شود)
          <input
            required
            maxLength={120}
            placeholder="مثلا: اتصال CRM"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          نقش
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as OrganizationRole)}
          >
            {KEY_ROLES.map((value) => (
              <option key={value} value={value}>
                {ROLE_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <label>
          انقضا (اختیاری)
          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <button type="submit" disabled={create.isPending}>
          {create.isPending ? "در حال ساخت…" : "ساخت کلید"}
        </button>
      </form>

      {fresh && (
        <div className="template-selected">
          <span>
            کلید «{fresh.name}» ساخته شد. همین حالا جایی امن ذخیره‌اش کنید؛ در
            سامانه فقط هشش می‌ماند و دیگر نشان داده نمی‌شود:
            <br />
            <code dir="ltr" style={{ wordBreak: "break-all" }}>
              {fresh.key}
            </code>
          </span>
          <button type="button" onClick={copy}>
            {copied ? "کپی شد" : "کپی کلید"}
          </button>
        </div>
      )}
    </section>
  );
}
