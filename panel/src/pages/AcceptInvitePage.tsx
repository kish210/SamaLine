import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { FormEvent } from "react";
import { describeError, teamApi } from "../api";
import { useAuth } from "../auth";
import type { AuthPayload } from "../types";

/**
 * پذیرش دعوت تیم از لینک ایمیل (`/panel/accept-invite?token=…`).
 *
 * بیرون از ورود در دسترس است. اگر ایمیل دعوت حساب داشته باشد، با رمز همان
 * حساب (و کد ورود دومرحله‌ای، اگر روشن است) پذیرفته می‌شود؛ وگرنه همین‌جا
 * حساب تازه ساخته می‌شود.
 */
export function AcceptInvitePage() {
  const signIn = useAuth((s) => s.signIn);
  const [token] = useState(
    () => new URLSearchParams(window.location.search).get("token") ?? "",
  );
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [needsCode, setNeedsCode] = useState(false);

  const preview = useQuery({
    queryKey: ["invitation", token],
    queryFn: () => teamApi.previewInvitation(token),
    enabled: Boolean(token),
    retry: false,
  });

  const accept = useMutation({
    mutationFn: () =>
      teamApi.acceptInvitation({
        token,
        password,
        fullName: fullName.trim() || undefined,
        totpCode: totpCode.trim() || undefined,
      }),
    onSuccess: (result) => {
      if ("twoFactorRequired" in result) {
        setNeedsCode(true);
        setError("کد برنامه‌ی احراز هویت را وارد کنید");
        return;
      }
      // ورود با نشست سازمان تازه؛ پنل بی‌درنگ باز می‌شود.
      signIn(result as AuthPayload);
      window.location.replace(import.meta.env.BASE_URL);
    },
    onError: (err) => setError(describeError(err)),
  });

  const existing = preview.data?.accountExists ?? false;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!existing && password.length < 8) {
      setError("رمز عبور باید دست‌کم ۸ نویسه باشد");
      return;
    }
    setError(null);
    accept.mutate();
  };

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <div className="auth-brand">
          <span className="brand-mark" aria-hidden="true">
            س
          </span>
          <h1>پذیرش دعوت</h1>
        </div>

        {!token && (
          <p className="error">
            لینک ناقص است؛ لینک کامل ایمیل را باز کنید یا از دعوت‌کننده لینک
            تازه بخواهید.
          </p>
        )}

        {preview.isLoading && <p className="hint">در حال بررسی دعوت…</p>}
        {preview.isError && (
          <p className="error">{describeError(preview.error)}</p>
        )}

        {preview.data && (
          <>
            <p className="hint">
              به تیم <strong>{preview.data.organizationName}</strong> با نقش{" "}
              <strong>{preview.data.roleLabel}</strong> دعوت شده‌اید.
            </p>
            <form onSubmit={submit}>
              <label>
                ایمیل
                <input
                  type="email"
                  dir="ltr"
                  value={preview.data.email}
                  disabled
                />
              </label>

              {!existing && (
                <label>
                  نام و نام خانوادگی
                  <input
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </label>
              )}

              <label>
                {existing
                  ? "رمز حساب فعلی شما"
                  : "رمز عبور تازه (دست‌کم ۸ نویسه)"}
                <input
                  type="password"
                  autoComplete={existing ? "current-password" : "new-password"}
                  required
                  minLength={existing ? undefined : 8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>

              {(needsCode || preview.data.twoFactorRequired) && (
                <label>
                  کد ورود دومرحله‌ای
                  <input
                    dir="ltr"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                  />
                </label>
              )}

              {error && <p className="error">{error}</p>}
              <button type="submit" disabled={accept.isPending}>
                {accept.isPending ? "در حال پذیرش…" : "پذیرش و ورود"}
              </button>
            </form>

            {existing && (
              <p className="hint">
                این ایمیل از قبل حساب دارد؛ با همان رمز بپذیرید تا هر دو سازمان
                در یک حساب بمانند.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
