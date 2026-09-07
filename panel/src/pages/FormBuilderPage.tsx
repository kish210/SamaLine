import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { describeError, formsApi } from '../api';
import { formUrl } from '../renderer-url';
import type { FormPage, Question, QuestionType } from '../types';
import { CustomLinkCard } from './builder/CustomLinkCard';
import { FlowChart } from './builder/FlowChart';
import { AddQuestionMenu } from './builder/AddQuestionMenu';
import { AiReviewCard } from './builder/AiReviewCard';
import { EdgePagesEditor } from './builder/EdgePagesEditor';
import { LivePreview } from './builder/LivePreview';
import { PublishCard } from './builder/PublishCard';
import { QuestionEditor } from './builder/QuestionEditor';
import { ThemeEditor } from './builder/ThemeEditor';
import { ResponsesPanel } from './builder/ResponsesPanel';
import { IndicatorEditor, useIndicators } from './builder/IndicatorEditor';
import { useSkipRules } from './builder/useSkipRules';

type Tab = 'build' | 'design' | 'flow' | 'report';

const newQuestion = (
  index: number,
  type: QuestionType = 'short_text',
): Question => ({
  id: `q${index}`,
  type,
  title: 'سوال جدید',
  required: false,
});

/**
 * شناسه‌ی یکتا برای سوال کپی‌شده.
 *
 * شناسه در منطق پرش و Piping مرجع است، پس کپی نباید شناسه‌ی سوال اصلی را
 * تکرار کند وگرنه قوانین به سوال اشتباه اشاره می‌کنند.
 */
function uniqueQuestionId(base: string, taken: Set<string>): string {
  const stem = base.replace(/_copy\d*$/, '');
  for (let i = 1; ; i += 1) {
    const candidate = i === 1 ? `${stem}_copy` : `${stem}_copy${i}`;
    if (!taken.has(candidate)) return candidate;
  }
}

export function FormBuilderPage() {
  const { formId = '' } = useParams();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('build');
  const [pages, setPages] = useState<FormPage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  /*
   * پیش‌نمایش، فرمِ منتشرشده روی سرور را نشان می‌دهد؛ پس تا وقتی ذخیره
   * نشده باشد با آنچه در ویرایشگر است فرق دارد. این دو مقدار همان تفاوت
   * را به کاربر می‌گویند و بعد از هر ذخیره iframe را تازه می‌کنند.
   */
  const [dirty, setDirty] = useState(false);
  const [previewVersion, setPreviewVersion] = useState(0);

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
      setDirty(false);
    }
  }, [loadedVersionId, form.data?.latestVersion?.structure.pages]);

  /*
   * قوانین نمایش و Piping اینجا ویرایش نمی‌شوند ولی باید حفظ شوند؛ اگر
   * فقط  فرستاده شود، سرور کل logic را جایگزین می‌کند و قوانین
   * نمایشِ قالب (مثل سوال‌های دروازه‌ای هتل) از بین می‌روند.
   */
  const existingLogic = form.data?.latestVersion?.structure.logic ?? {};

  const [skipRules, setSkipRules] = useSkipRules(
    form.data?.latestVersion?.structure.logic,
    loadedVersionId ?? '',
  );

  const [indexes, setIndexes] = useIndicators(
    form.data?.latestVersion?.structure.scoreIndexes,
    loadedVersionId ?? '',
  );

  const save = useMutation({
    mutationFn: () =>
      formsApi.update(formId, {
        pages,
        scoreConfig: { indices: indexes },
        logic: { ...existingLogic, skip: skipRules },
      }),
    onSuccess: async () => {
      setError(null);
      setSaved(true);
      setDirty(false);
      setPreviewVersion((prev) => prev + 1);
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

  /** هر ویرایش محلی، فرم را نسبت به نسخه‌ی ذخیره‌شده «تغییریافته» می‌کند. */
  const markDirty = () => setDirty(true);

  const updatePage = (pageIndex: number, patch: Partial<FormPage>) => {
    markDirty();
    setPages((prev) =>
      prev.map((page, i) => (i === pageIndex ? { ...page, ...patch } : page)),
    );
  };

  const updateQuestion = (
    pageIndex: number,
    questionIndex: number,
    patch: Partial<Question>,
  ) => {
    markDirty();
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
  };

  /** همه‌ی شناسه‌های سوال در کل فرم؛ برای ساخت شناسه‌ی یکتا. */
  const allQuestionIds = () =>
    new Set(pages.flatMap((page) => page.questions.map((q) => q.id)));

  /** کوچک‌ترین شماره‌ی آزاد برای شناسه‌ی سوال جدید. */
  const nextQuestionNumber = () => {
    const taken = allQuestionIds();
    for (let i = 1; ; i += 1) if (!taken.has(`q${i}`)) return i;
  };

  /**
   * سوال‌هایی که پیش از این سوال پرسیده می‌شوند.
   *
   * فقط پاسخ همین‌ها را می‌توان در عنوان درج کرد؛ ارجاع به سوالی که هنوز
   * پرسیده نشده، در زمان پاسخ‌دهی خالی درمی‌آید.
   */
  const earlierQuestions = (pageIndex: number, questionIndex: number) =>
    pages
      .slice(0, pageIndex + 1)
      .flatMap((page, pi) =>
        page.questions
          .filter((_, qi) => pi < pageIndex || qi < questionIndex)
          .map((q) => ({ id: q.id, title: q.title })),
      );

  const duplicateQuestion = (pageIndex: number, questionIndex: number) => {
    markDirty();
    setPages((prev) => {
      const taken = new Set(
        prev.flatMap((page) => page.questions.map((q) => q.id)),
      );
      return prev.map((page, i) => {
        if (i !== pageIndex) return page;
        const source = page.questions[questionIndex];
        const copy: Question = {
          ...structuredClone(source),
          id: uniqueQuestionId(source.id, taken),
        };
        const questions = [...page.questions];
        questions.splice(questionIndex + 1, 0, copy);
        return { ...page, questions };
      });
    });
  };

  const moveQuestion = (
    pageIndex: number,
    questionIndex: number,
    direction: -1 | 1,
  ) => {
    markDirty();
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
  };

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
        <>
          <PublishCard
            url={formUrl(
              form.data.publication.slug ?? form.data.publication.token,
            )}
            title={form.data.title}
          />
          <CustomLinkCard
            formId={formId}
            token={form.data.publication.token}
            currentSlug={form.data.publication.slug}
          />
        </>
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
          className={tab === 'design' ? 'active' : ''}
          onClick={() => setTab('design')}
        >
          ظاهر فرم
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
        <div className="builder-layout">
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
                    onClick={() => {
                      markDirty();
                      setPages((prev) =>
                        prev.filter((_, i) => i !== pageIndex),
                      );
                    }}
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
                  scoreIndexKeys={indexes}
                  earlierQuestions={earlierQuestions(pageIndex, questionIndex)}
                  onChange={(patch) =>
                    updateQuestion(pageIndex, questionIndex, patch)
                  }
                  onMove={(direction) =>
                    moveQuestion(pageIndex, questionIndex, direction)
                  }
                  onDuplicate={() => duplicateQuestion(pageIndex, questionIndex)}
                  onRemove={() =>
                    updatePage(pageIndex, {
                      questions: page.questions.filter(
                        (_, i) => i !== questionIndex,
                      ),
                    })
                  }
                />
              ))}

              <AddQuestionMenu
                onPick={(type) =>
                  updatePage(pageIndex, {
                    questions: [
                      ...page.questions,
                      newQuestion(nextQuestionNumber(), type),
                    ],
                  })
                }
              />
            </section>
          ))}

          <button
            type="button"
            className="secondary"
            onClick={() => {
              markDirty();
              setPages((prev) => [
                ...prev,
                {
                  id: `p${prev.length + 1}`,
                  title: `صفحه ${prev.length + 1}`,
                  questions: [newQuestion(nextQuestionNumber())],
                },
              ]);
            }}
          >
            + افزودن صفحه
          </button>
          </div>

          <div className="side-column">
            <LivePreview
              token={form.data.publication?.token}
              dirty={dirty}
              version={previewVersion}
            />
            <AiReviewCard pages={pages} />
          </div>
        </div>
      )}

      {tab === 'design' && (
        <div className="design-tab">
          <ThemeEditor formId={formId} settings={form.data.settings} />
          <EdgePagesEditor formId={formId} settings={form.data.settings} />
          <IndicatorEditor
            pages={pages}
            indexes={indexes}
            onChange={(next) => {
              setIndexes(next);
              setDirty(true);
            }}
          />
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
          {flow.data && (
            <FlowChart
              graph={flow.data}
              pages={pages}
              rules={skipRules}
              dirty={dirty}
              onChange={(next) => {
                setSkipRules(next);
                setDirty(true);
              }}
            />
          )}
        </div>
      )}

      {tab === 'report' && (
        <ResponsesPanel formId={formId} formTitle={form.data.title} />
      )}
    </div>
  );
}
