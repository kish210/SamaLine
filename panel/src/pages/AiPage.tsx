import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { aiApi, describeError, formsApi, workspaceApi } from '../api';
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

      return formsApi.create({
        workspaceId,
        title: generated.title,
        slug: `ai-${Date.now().toString(36)}`,
        pages: generated.pages,
        // تنظیماتِ مشتق‌شده از نوعِ فرم (نیازمندِ تأیید، چک‌لیست) را هم اعمال کن.
        ...(generated.settings && Object.keys(generated.settings).length
          ? { settings: generated.settings }
          : {}),
      });
    },
    onSuccess: async (form) => {
      await queryClient.invalidateQueries({ queryKey: ['forms'] });
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

          <button
            type="button"
            disabled={saveAsForm.isPending}
            onClick={() => saveAsForm.mutate()}
          >
            ذخیره به‌عنوان فرم و ویرایش
          </button>
        </section>
      )}
    </div>
  );
}
