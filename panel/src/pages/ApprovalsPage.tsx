import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { describeError, responsesApi, workspaceApi } from "../api";
import type { PendingReview } from "../api";

/**
 * کارتابلِ درخواست‌های در انتظارِ تأیید (فاز H).
 *
 * همهٔ درخواست‌های معلقِ فرم‌های نیازمندِ تأیید را که مدیر به بخششان دسترسی
 * دارد، یک‌جا نشان می‌دهد تا لازم نباشد تک‌تکِ فرم‌ها باز شوند. تأیید/رد همین‌جا.
 */
export function ApprovalsPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const workspaces = useQuery({
    queryKey: ["workspaces"],
    queryFn: workspaceApi.list,
  });
  const workspaceId = workspaces.data?.[0]?.id ?? "";

  const pending = useQuery({
    queryKey: ["pending-reviews", workspaceId],
    queryFn: () => responsesApi.pending(workspaceId),
    enabled: Boolean(workspaceId),
  });

  const decide = useMutation({
    mutationFn: ({
      id,
      decision,
      note,
    }: {
      id: string;
      decision: "approved" | "rejected";
      note?: string;
    }) => responsesApi.review(id, { decision, note }),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["pending-reviews"] });
    },
    onError: (err) => setError(describeError(err)),
  });

  const act = (row: PendingReview, decision: "approved" | "rejected") => {
    const note =
      decision === "rejected"
        ? window.prompt("دلیلِ رد (اختیاری):") ?? ""
        : "";
    decide.mutate({ id: row.responseId, decision, note });
  };

  const rows = pending.data ?? [];

  return (
    <div className="page">
      <header className="page-header">
        <h1>کارتابلِ تأیید</h1>
      </header>

      {error && <p className="error">{error}</p>}

      <section className="card">
        <div className="section-head">
          <h3>{rows.length} درخواستِ در انتظار</h3>
        </div>

        {pending.isLoading && <p>در حال بارگذاری…</p>}
        {!pending.isLoading && rows.length === 0 && (
          <p className="empty">درخواستِ معلقی نیست. 👌</p>
        )}

        {rows.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>فرم</th>
                <th>درخواست‌دهنده</th>
                <th>زمان</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.responseId}>
                  <td>{row.formTitle}</td>
                  <td dir="ltr" style={{ textAlign: "right" }}>
                    {row.respondentKey || "—"}
                  </td>
                  <td className="nowrap">
                    {(row.requestedAt ?? row.submittedAt)
                      ? new Date(
                          (row.requestedAt ?? row.submittedAt) as string,
                        ).toLocaleDateString("fa-IR")
                      : "—"}
                  </td>
                  <td className="nowrap">
                    <button
                      type="button"
                      disabled={decide.isPending}
                      onClick={() => act(row, "approved")}
                    >
                      تأیید
                    </button>{" "}
                    <button
                      type="button"
                      className="secondary"
                      disabled={decide.isPending}
                      onClick={() => act(row, "rejected")}
                    >
                      رد
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
