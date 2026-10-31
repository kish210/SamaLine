import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { aiApi, describeError, formsApi, hotelSetupApi, workspaceApi } from '../api';
import type { FormPage } from '../types';

interface GeneratedForm {
  title: string;
  language: string;
  pages: FormPage[];
  aiProvider: string;
  kind?: 'survey' | 'request' | 'checklist' | 'operational';
  settings?: Record<string, unknown>;
  hints?: string[];
}

/** نتیجه‌ی ساختِ خودکارِ داشبورد/پرتال برای فرمِ تازه. */
interface BuildReport {
  dashboardId?: string;
  portalSlug?: string | null;
  /** علتِ نساختنِ پرتال (معمولاً سقفِ پلن). */
  portalError?: string | null;
  /** کلِ ساختِ گزارش شکست خورد. */
  failed?: string;
}

const KIND_LABELS: Record<string, string> = {
  survey: 'نظرسنجی',
  request: 'درخواست (نیازمندِ تأیید)',
  checklist: 'چک‌لیستِ دوره‌ای',
  operational: 'فرمِ عملیاتی',
};

/** ساخت پرسشنامه با هوش مصنوعی (بند ۱۰ سند). */
export function AiPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [goal, setGoal] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState<GeneratedForm | null>(null);
  const [autoReport, setAutoReport] = useState(true);
  // نتیجه‌ی ساختِ فرم + داشبورد/پرتال، تا کاربر ببیند واقعاً چه ساخته شد.
  const [built, setBuilt] = useState<{
    formId: string;
    report: BuildReport;
  } | null>(null);

  const generate = useMutation({
    mutationFn: () => aiApi.createSurvey(goal),
    onSuccess: (data) => {
      setError(null);
      setGenerated(data as unknown as GeneratedForm);
    },
    onError: (err) => setError(describeError(err)),
  });

  // ساختار تولیدشده پیش از رسیدن به اینجا سمت سرور با schema
  // اعتبارسنجی شده است، پس مستقیم قابل ذخیره است.
  const saveAsForm = useMutation({
    mutationFn: async () => {
      if (!generated) throw new Error('ساختاری برای ذخیره نیست');
      const workspaces = await workspaceApi.list();
      const workspaceId = workspaces[0]?.id;
      if (!workspaceId) throw new Error('فضای کاری یافت نشد');

      const form = await formsApi.create({
        workspaceId,
        title: generated.title,
        slug: `ai-${Date.now().toString(36)}`,
        pages: generated.pages,
        // تنظیماتِ مشتق‌شده از نوعِ فرم (نیازمندِ تأیید، چک‌لیست) را هم اعمال کن.
        ...(generated.settings && Object.keys(generated.settings).length
          ? { settings: generated.settings }
          : {}),
      });

      /*
       * ساختِ خودکارِ داشبورد + پرتال؛ بهترین‌تلاش است و مانعِ ساختِ فرم
       * نمی‌شود، ولی نتیجه‌اش دیگر بی‌صدا دور ریخته نمی‌شود: پیش از این حتی
       * وقتی سقفِ پرتالِ پلن پر بود کاربر هیچ نشانه‌ای نمی‌دید و گمان می‌کرد
       * داشبوردساز کار نمی‌کند.
       */
      let report: BuildReport | null = null;
      if (autoReport) {
        try {
          report = (await hotelSetupApi.formReport(form.id)) as BuildReport;
        } catch (err) {
          report = { failed: describeError(err) };
        }
      }
      return { form, report };
    },
    onSuccess: async ({ form, report }) => {
      await queryClient.invalidateQueries({ queryKey: ['forms'] });
      // اگر چیزی برای گفتن هست (ساخته شد یا نشد) نشان بده و صبر کن؛ وگرنه
      // مثل قبل مستقیم به فرم‌ساز برو.
      if (report) {
        setBuilt({ formId: form.id, report });
        return;
      }
      navigate(`/forms/${form.id}`);
    },
    onError: (err) =>
      setError(err instanceof Error ? err.message : describeError(err)),
  });

  return (
    <div className="page">
      <header className="page-header">
        <h1>ساخت فرم با هوش مصنوعی</h1>
      </header>

      {error && <p className="error">{error}</p>}

      {built && (
        <section className="card">
          <h3>فرم ساخته شد</h3>
          <ul>
            <li>✅ فرم و سوال‌هایش ساخته شد.</li>
            {built.report.failed ? (
              <li>
                ⚠️ داشبورد و پرتالِ خودکار ساخته نشد: {built.report.failed}
              </li>
            ) : (
              <>
                <li>
                  {built.report.dashboardId
                    ? '✅ داشبوردِ گزارشِ این فرم ساخته شد (بخشِ «داشبوردها»).'
                    : '⚠️ داشبورد ساخته نشد.'}
                </li>
                <li>
                  {built.report.portalSlug
                    ? `✅ پرتالِ این فرم ساخته شد (نشانی: ${built.report.portalSlug}).`
                    : `⚠️ پرتال ساخته نشد${
                        built.report.portalError
                          ? `: ${built.report.portalError}`
                          : '.'
                      }`}
                </li>
              </>
            )}
          </ul>
          <button type="button" onClick={() => navigate(`/forms/${built.formId}`)}>
            رفتن به فرم‌ساز
          </button>
        </section>
      )}

      <section className="card">
        <label>
          هدف یا نوعِ فرم را به زبانِ طبیعی بنویسید
          <textarea
            rows={3}
            value={goal}
            placeholder="مثال: فرم درخواست مرخصی پرسنل / چک‌لیست روزانه تأسیسات / نظرسنجی رضایت مهمان هتل"
            onChange={(e) => setGoal(e.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={!goal.trim() || generate.isPending}
          onClick={() => generate.mutate()}
        >
          {generate.isPending ? 'در حال ساخت…' : 'ساخت پرسشنامه'}
        </button>
      </section>

      {generated && (
        <section className="card">
          <h3>{generated.title}</h3>
          <p className="hint">
            نوعِ فرم: <strong>{KIND_LABELS[generated.kind ?? 'survey']}</strong> · سرویس‌دهنده: {generated.aiProvider}
          </p>
          {(generated.hints ?? []).map((h, i) => (
            <p key={i} className="hint">💡 {h}</p>
          ))}

          {generated.pages.map((page) => (
            <div key={page.id} className="preview-page">
              <h4>{page.title}</h4>
              <ol>
                {page.questions.map((question) => (
                  <li key={question.id}>
                    {question.title}
                    <span className="badge">{question.type}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}

          <label className="checkbox">
            <input
              type="checkbox"
              checked={autoReport}
              onChange={(e) => setAutoReport(e.target.checked)}
            />
            داشبورد و پرتالِ خودکار برای این فرم هم ساخته شود
          </label>

          <button
            type="button"
            disabled={saveAsForm.isPending}
            onClick={() => saveAsForm.mutate()}
          >
            {saveAsForm.isPending ? 'در حال ساخت…' : 'ذخیره به‌عنوان فرم و ویرایش'}
          </button>
        </section>
      )}
    </div>
  );
}
