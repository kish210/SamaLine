import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { describeError, formsApi } from '../api';
import type { FormPage, Question } from '../types';
import { CustomLinkCard } from './builder/CustomLinkCard';
import { FlowChart } from './builder/FlowChart';
import { QuestionEditor } from './builder/QuestionEditor';
import { ResponsesPanel } from './builder/ResponsesPanel';

type Tab = 'build' | 'flow' | 'report';

const newQuestion = (index: number): Question => ({
  id: `q${index}`,
  type: 'short_text',
  title: 'سوال جدید',
  required: false,
});

export function FormBuilderPage() {
  const { formId = '' } = useParams();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('build');
  const [pages, setPages] = useState<FormPage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const form = useQuery({
    queryKey: ['form', formId],
    queryFn: () => formsApi.get(formId),
    enabled: Boolean(formId),
  });

  // ساختار سرور تنها یک بار در وضعیت محلی نشانده می‌شود؛ پس از آن
  // ویرایش‌های کاربر مرجع‌اند تا با هر بازخوانی بازنویسی نشوند.
  const loadedVersionId = form.data?.latestVersion?.id;
  useEffect(() => {
    if (form.data?.latestVersion?.structure.pages) {
      setPages(form.data.latestVersion.structure.pages);
    }
  }, [loadedVersionId, form.data?.latestVersion?.structure.pages]);

  const scoreIndexes = form.data?.latestVersion?.structure.scoreIndexes ?? [];

  const save = useMutation({
    mutationFn: () => formsApi.update(formId, { pages }),
    onSuccess: async () => {
      setError(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      await queryClient.invalidateQueries({ queryKey: ['form', formId] });
      await queryClient.invalidateQueries({ queryKey: ['flow', formId] });
    },
    onError: (err) => setError(describeError(err)),
  });

  const publish = useMutation({
    mutationFn: () => formsApi.publishLink(formId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['form', formId] });
    },
    onError: (err) => setError(describeError(err)),
  });

  const flow = useQuery({
    queryKey: ['flow', formId],
    queryFn: () => formsApi.flowGraph(formId),
    enabled: Boolean(formId) && tab === 'flow',
  });

  const analysis = useQuery({
    queryKey: ['logic', formId],
    queryFn: () => formsApi.logicAnalysis(formId),
    enabled: Boolean(formId) && tab === 'flow',
  });

  const updatePage = (pageIndex: number, patch: Partial<FormPage>) =>
    setPages((prev) =>
      prev.map((page, i) => (i === pageIndex ? { ...page, ...patch } : page)),
    );

  const updateQuestion = (
    pageIndex: number,
    questionIndex: number,
    patch: Partial<Question>,
  ) =>
    setPages((prev) =>
      prev.map((page, i) =>
        i !== pageIndex
          ? page
          : {
              ...page,
              questions: page.questions.map((q, qi) =>
                qi === questionIndex ? { ...q, ...patch } : q,
              ),
            },
      ),
    );

  const moveQuestion = (
    pageIndex: number,
    questionIndex: number,
    direction: -1 | 1,
  ) =>
    setPages((prev) =>
      prev.map((page, i) => {
        if (i !== pageIndex) return page;
        const questions = [...page.questions];
        const target = questionIndex + direction;
        if (target < 0 || target >= questions.length) return page;
        [questions[questionIndex], questions[target]] = [
          questions[target],
          questions[questionIndex],
        ];
        return { ...page, questions };
      }),
    );

  if (form.isLoading) return <div className="page">در حال بارگذاری…</div>;
  if (!form.data) return <div className="page">فرم یافت نشد.</div>;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <Link to="/forms" className="back">
            ← فرم‌ها
          </Link>
          <h1>{form.data.title}</h1>
        </div>
        <div className="header-actions">
          {saved && <span className="saved">ذخیره شد</span>}
          <button
            type="button"
            onClick={() => save.mutate()}
            disabled={save.isPending}
          >
            ذخیره
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => publish.mutate()}
            disabled={publish.isPending}
          >
            انتشار لینک
          </button>
        </div>
      </header>

      {error && <p className="error">{error}</p>}

      {form.data.publication && tab === 'build' && (
        <CustomLinkCard
          formId={formId}
          token={form.data.publication.token}
          currentSlug={form.data.publication.slug}
        />
      )}

      <div className="tabs">
        <button
          type="button"
          className={tab === 'build' ? 'active' : ''}
          onClick={() => setTab('build')}
        >
          ساخت فرم
        </button>
        <button
          type="button"
          className={tab === 'flow' ? 'active' : ''}
          onClick={() => setTab('flow')}
        >
          نمودار مسیر
        </button>
        <button
          type="button"
          className={tab === 'report' ? 'active' : ''}
          onClick={() => setTab('report')}
        >
          گزارش
        </button>
      </div>

      {tab === 'build' && (
        <div className="builder">
          {pages.map((page, pageIndex) => (
            <section key={page.id} className="page-section">
              <div className="page-title-row">
                <input
                  className="page-title"
                  value={page.title}
                  onChange={(e) =>
                    updatePage(pageIndex, { title: e.target.value })
                  }
                />
                {pages.length > 1 && (
                  <button
                    type="button"
                    className="danger"
                    onClick={() =>
                      setPages((prev) => prev.filter((_, i) => i !== pageIndex))
                    }
                  >
                    حذف صفحه
                  </button>
                )}
              </div>

              {page.questions.map((question, questionIndex) => (
                <QuestionEditor
                  key={`${page.id}-${questionIndex}`}
                  question={question}
                  index={questionIndex}
                  total={page.questions.length}
                  scoreIndexKeys={scoreIndexes}
                  onChange={(patch) =>
                    updateQuestion(pageIndex, questionIndex, patch)
                  }
                  onMove={(direction) =>
                    moveQuestion(pageIndex, questionIndex, direction)
                  }
                  onRemove={() =>
                    updatePage(pageIndex, {
                      questions: page.questions.filter(
                        (_, i) => i !== questionIndex,
                      ),
                    })
                  }
                />
              ))}

              <button
                type="button"
                className="secondary"
                onClick={() =>
                  updatePage(pageIndex, {
                    questions: [
                      ...page.questions,
                      newQuestion(page.questions.length + 1),
                    ],
                  })
                }
              >
                + افزودن سوال
              </button>
            </section>
          ))}

          <button
            type="button"
            className="secondary"
            onClick={() =>
              setPages((prev) => [
                ...prev,
                {
                  id: `p${prev.length + 1}`,
                  title: `صفحه ${prev.length + 1}`,
                  questions: [newQuestion(1)],
                },
              ])
            }
          >
            + افزودن صفحه
          </button>
        </div>
      )}

      {tab === 'flow' && (
        <div className="flow-tab">
          {analysis.data && (
            <div
              className={
                analysis.data.isValid ? 'analysis valid' : 'analysis invalid'
              }
            >
              <strong>
                {analysis.data.isValid
                  ? 'منطق فرم معتبر است'
                  : 'منطق فرم ایراد دارد'}
              </strong>
              {analysis.data.errors.map((e) => (
                <p key={e} className="error-line">
                  {e}
                </p>
              ))}
              {analysis.data.warnings.map((w) => (
                <p key={w} className="warning-line">
                  {w}
                </p>
              ))}
            </div>
          )}
          {flow.data && <FlowChart graph={flow.data} />}
        </div>
      )}

      {tab === 'report' && <ResponsesPanel formId={formId} />}
    </div>
  );
}
