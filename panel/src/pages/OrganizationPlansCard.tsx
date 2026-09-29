import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  adminApi,
  describeError,
  type OrganizationOverview,
  type PlanCode,
} from '../api';

const PLAN_LABELS: Record<PlanCode, string> = {
  free: 'رایگان',
  pro: 'حرفه‌ای',
  org: 'سازمانی',
  enterprise: 'اختصاصی',
};

/**
 * سازمان‌ها و پلن‌هایشان — کارت پنل سوپرادمین.
 *
 * تغییر پلن عمداً فقط از اینجاست: پیش از این هر سازمانی می‌توانست با یک
 * درخواست API پلن خودش را بی‌پرداخت ارتقا دهد. حالا گرداننده‌ی سکو پس از
 * دریافت وجه یا عقد قرارداد پلن را فعال می‌کند.
 */
export function OrganizationPlansCard() {
  const organizations = useQuery({
    queryKey: ['admin-organizations'],
    queryFn: adminApi.organizations,
  });

  return (
    <section className="card">
      <div className="section-head">
        <h3>سازمان‌ها و پلن‌ها</h3>
      </div>
      <p className="hint">
        پلن هر سازمان سقف فرم، پاسخ‌نامه و امکاناتش را تعیین می‌کند. با گذشتن
        تاریخ انقضا، سازمان خودکار به پلن رایگان برمی‌گردد.
      </p>

      {organizations.isLoading && <p>در حال بارگذاری…</p>}
      {organizations.isError && (
        <p className="error">{describeError(organizations.error)}</p>
      )}

      {organizations.data && organizations.data.length === 0 && (
        <p className="hint">هنوز سازمانی ثبت نشده است.</p>
      )}

      {organizations.data && organizations.data.length > 0 && (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>سازمان</th>
                <th>پلن فعلی</th>
                <th>انقضا</th>
                <th>تغییر</th>
              </tr>
            </thead>
            <tbody>
              {organizations.data.map((row) => (
                <OrganizationRow key={row.organization.id} row={row} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function OrganizationRow({ row }: { row: OrganizationOverview }) {
  const queryClient = useQueryClient();
  const current = row.subscription?.planCode ?? 'free';
  const [plan, setPlan] = useState<PlanCode>(current);
  const [expiresAt, setExpiresAt] = useState(
    row.subscription?.expiresAt?.slice(0, 10) ?? '',
  );
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => adminApi.setPlan(row.organization.id, plan, expiresAt),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({
        queryKey: ['admin-organizations'],
      });
    },
    onError: (err) => setError(describeError(err)),
  });

  const expired =
    row.subscription?.expiresAt &&
    new Date(row.subscription.expiresAt) < new Date();

  return (
    <tr>
      <td>{row.organization.name}</td>
      <td>
        {PLAN_LABELS[current]}
        {expired && <span className="hint"> (منقضی)</span>}
      </td>
      <td>
        <input
          type="date"
          dir="ltr"
          style={{ width: 'auto' }}
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          aria-label="تاریخ انقضا"
        />
      </td>
      <td>
        <select
          style={{ width: 'auto' }}
          value={plan}
          onChange={(e) => setPlan(e.target.value as PlanCode)}
          aria-label="پلن"
        >
          {(Object.keys(PLAN_LABELS) as PlanCode[]).map((code) => (
            <option key={code} value={code}>
              {PLAN_LABELS[code]}
            </option>
          ))}
        </select>{' '}
        <button
          type="button"
          style={{ width: 'auto' }}
          disabled={save.isPending}
          onClick={() => save.mutate()}
        >
          اعمال
        </button>
        {error && <div className="error">{error}</div>}
      </td>
    </tr>
  );
}
