import { useQuery } from '@tanstack/react-query';
import { messagingApi, plansApi, workspaceApi } from '../api';
import { TelegramCard } from './TelegramCard';
import { ChangePasswordCard } from './ChangePasswordCard';
import { TwoFactorCard } from './TwoFactorCard';
import { WebhooksCard } from './WebhooksCard';
import { useAuth } from '../auth';

const LIMIT_LABELS: Record<string, string> = {
  activeForms: 'تعداد فرم فعال',
  responsesPerMonth: 'پاسخ‌نامه در ماه',
  maxQuestionTypes: 'انواع سوال',
  workspaceUsers: 'کاربر فضای کاری',
  logicDisplay: 'منطق شرطی نمایش',
  logicSkip: 'منطق پرش و فلوچارت',
  indices: 'شاخص و وزن‌دهی',
  multiLanguage: 'چندزبانه',
  smsPanel: 'پنل پیامکی',
  emailPanel: 'پنل ایمیلی',
  embed: 'کد Embed و Pop-up',
  kiosk: 'کیوسک',
  interviewer: 'پرسشگر میدانی',
  portal: 'پرتال',
  webhooks: 'وبهوک',
  dashboards: 'داشبوردساز',
  api: 'API برنامه‌نویسان',
  advancedExcel: 'اکسل پیشرفته',
  powerpointExport: 'خروجی PowerPoint',
  customDomain: 'دامنه اختصاصی',
  aiCreate: 'ساخت پرسشنامه با AI',
  aiReview: 'بازنگری با AI',
  aiAnalyze: 'تحلیل پاسخ‌ها با AI',
};

function renderLimit(value: unknown): string {
  if (typeof value === 'boolean') return value ? '✓' : '—';
  if (value === -1) return 'نامحدود';
  return String(value);
}

export function SettingsPage() {
  const user = useAuth((s) => s.user);
  const organizationId = user?.organizationId ?? '';

  const policy = useQuery({
    queryKey: ['policy', organizationId],
    queryFn: () => plansApi.policy(organizationId),
    enabled: Boolean(organizationId),
  });

  const workspaces = useQuery({
    queryKey: ['workspaces'],
    queryFn: workspaceApi.list,
  });
  const workspaceId = workspaces.data?.[0]?.id ?? '';

  const messaging = useQuery({
    queryKey: ['messaging-status'],
    queryFn: messagingApi.status,
  });

  return (
    <div className="page">
      <header className="page-header">
        <h1>تنظیمات</h1>
      </header>

      <section className="card">
        <h3>حساب کاربری</h3>
        <dl className="info-list">
          <dt>نام</dt>
          <dd>{user?.fullName}</dd>
          <dt>ایمیل</dt>
          <dd>{user?.email}</dd>
        </dl>
      </section>

      <ChangePasswordCard />

      <TwoFactorCard />

      <section className="card">
        <h3>سرویس‌های ارسال</h3>
        {messaging.data ? (
          <>
            <dl className="info-list">
              <dt>پیامک</dt>
              <dd>{messaging.data.providers.sms}</dd>
              <dt>ایمیل</dt>
              <dd>{messaging.data.providers.email}</dd>
              <dt>صف ارسال</dt>
              <dd>
                {messaging.data.queue.active} در حال اجرا،{' '}
                {messaging.data.queue.pending} در انتظار
              </dd>
            </dl>
            {messaging.data.providers.sms === 'local' && (
              <p className="hint">
                در حالت محلی، پیام‌ها به‌جای ارسال واقعی در پوشه‌ی
                <code> backend/data/outbox </code> ذخیره می‌شوند.
              </p>
            )}
          </>
        ) : (
          <p>در حال بارگذاری…</p>
        )}
      </section>

      {workspaceId && <TelegramCard workspaceId={workspaceId} />}

      <WebhooksCard />

      <section className="card">
        <h3>امکانات پلن شما</h3>
        {policy.data ? (
          <div className="table-scroll">
            <table>
              <tbody>
                {Object.entries(policy.data).map(([key, value]) => (
                  <tr key={key}>
                    <td>{LIMIT_LABELS[key] ?? key}</td>
                    <td>{renderLimit(value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>در حال بارگذاری…</p>
        )}
      </section>
    </div>
  );
}
