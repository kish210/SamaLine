import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { describeError, formsApi } from '../api';
import { formUrl } from '../renderer-url';
import type { FormPage, Question, QuestionType } from '../types';
import { CustomLinkCard } from './builder/CustomLinkCard';
import { DisplayRuleEditor } from './builder/DisplayRuleEditor';
import { FlowChart } from './builder/FlowChart';
import { AddQuestionMenu } from './builder/AddQuestionMenu';
import { QuestionBankMenu } from './builder/QuestionBankMenu';
import type { BankQuestion } from '../question-bank';
import { AiReviewCard } from './builder/AiReviewCard';
import { DepartmentCard } from './builder/DepartmentCard';
import { EdgePagesEditor } from './builder/EdgePagesEditor';
import { ChecklistEditor } from './builder/ChecklistEditor';
import { ReminderEditor } from './builder/ReminderEditor';
import { WorkflowEditor } from './builder/WorkflowEditor';
import { BotPublishCard } from './builder/BotPublishCard';
import { LivePreview } from './builder/LivePreview';
import { AccessModeCard } from './builder/AccessModeCard';
import { PublishCard } from './builder/PublishCard';
import { QuestionEditor } from './builder/QuestionEditor';
import { ThemeEditor } from './builder/ThemeEditor';
import { ResponsesPanel } from './builder/ResponsesPanel';
import { IndicatorEditor, useIndicators } from './builder/IndicatorEditor';
import { useDisplayRules } from './builder/useDisplayRules';
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
 * شناسه دادن به سوال‌هایی که از بانک می‌آیند.
 *
 * شناسه‌ها در یک حلقه ساخته می‌شوند و هرکدام بلافاصله به مجموعه‌ی گرفته‌شده‌ها
 * اضافه می‌شود؛ بدون این، افزودن سه سوال با هم هر سه را `q5` می‌نامید — چون
 * هیچ‌کدام هنوز در صفحه ننشسته‌اند تا شماره‌ی بعدی را جلو ببرند.
 */
function withFreshIds(
  questions: BankQuestion[],
  taken: Set<string>,
): Question[] {
  const used = new Set(taken);
  return questions.map((question) => {
    let index = 1;
    while (used.has(`q${index}`)) index += 1;
    const id = `q${index}`;
    used.add(id);
    return { ...question, id };
  });
}

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
  // آکاردئون چندتایی: هر سوال می‌تواند جداگانه باز/بسته باشد. پیش‌فرض فقط اولی
  // باز است تا هنگامِ افزودن فشرده بماند، ولی کاربر می‌تواند با «باز کردن همه»
  // کلِ فرم (مثلاً گزینه‌های سوال‌های چندگزینه‌ایِ فرمِ AI) را یک‌جا ببیند/ویرایش کند.
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allQuestionIdList = () =>
    pages.flatMap((page) => page.questions.map((q) => q.id));
  const [title, setTitle] = useState('');
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
      const loaded = form.data.latestVersion.structure.pages;
      setPages(loaded);
      setDirty(false);
      // اولین سوال را باز نگه دار تا فرم خالی به‌نظر نرسد (اگر کاربر هنوز
      // چیزی را دستی باز/بسته نکرده).
      setExpandedIds((prev) => {
        if (prev.size) return prev;
        const first = loaded[0]?.questions?.[0]?.id;
        return new Set(first ? [first] : []);
      });
    }
  }, [loadedVersionId, form.data?.latestVersion?.structure.pages]);

  // نام فرم فقط یک بار (هنگام بارگذاری فرم) در وضعیت محلی نشانده می‌شود تا
  // ویرایشِ کاربر با بازخوانیِ بعد از ذخیره بازنویسی نشود.
  const loadedFormId = form.data?.id;
  useEffect(() => {
    if (form.data?.title !== undefined) setTitle(form.data.title);
  }, [loadedFormId]); // eslint-disable-line react-hooks/exhaustive-deps

  /*
   * سرور کل `logic` را جایگزین می‌کند، نه ادغام. پس هر بار باید تمامش
   * فرستاده شود وگرنه کلیدهایی که اینجا ویرایشگر ندارند (مثل Piping) بی‌صدا
   * پاک می‌شوند.
   */
  const existingLogic = form.data?.latestVersion?.structure.logic ?? {};

  const [skipRules, setSkipRules] = useSkipRules(
    form.data?.latestVersion?.structure.logic,
    loadedVersionId ?? '',
  );

  const [displayRules, setDisplayRules] = useDisplayRules(
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
        title: title.trim() || form.data?.title,
        pages,
        scoreConfig: { indices: indexes },
        logic: { ...existingLogic, skip: skipRules, display: displayRules },
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

  /**
   * جابه‌جایی سوال از یک جایگاه به جایگاه دیگر (کشیدن و رها کردن).
   *
   * برخلاف moveQuestion که فقط یک پله بالا/پایین می‌برد، این سوال را از هرجا
   * به هرجای همان صفحه می‌برد. splice به‌جای جابه‌جایی دوتایی است چون بردن
   * سوال ۱ به جای ۵ باید سه سوال میانی را یکی‌یکی سُر بدهد، نه اینکه دوتا را
   * با هم عوض کند.
   */
  const reorderQuestion = (pageIndex: number, from: number, to: number) => {
    if (from === to) return;
    markDirty();
    setPages((prev) =>
      prev.map((page, i) => {
        if (i !== pageIndex) return page;
        const questions = [...page.questions];
        const [moved] = questions.splice(from, 1);
        questions.splice(to, 0, moved);
        return { ...page, questions };
      }),
    );
  };

  /*
   * وضعیت کشیدن: کدام صفحه، از کدام جایگاه، و الان روی کدام جایگاه است.
   * `over` برای نشان دادن محل رها شدن پیش از رها کردن است.
   */
  const [drag, setDrag] = useState<{
    page: number;
    from: number;
    over: number;
  } | null>(null);

  if (form.isLoading) return <div className="page">در حال بارگذاری…</div>;
  if (!form.data) return <div className="page">فرم یافت نشد.</div>;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <Link to="/forms" className="back">
            ← فرم‌ها
          </Link>
          <input
            className="form-title-input"
            value={title}
            placeholder="نام فرم"
            aria-label="نام فرم"
            title="برای تغییر نام فرم اینجا بنویسید"
            style={{
              font: 'inherit',
              fontSize: '1.5rem',
              fontWeight: 700,
              border: '1px solid transparent',
              borderRadius: 8,
              padding: '2px 8px',
              background: 'transparent',
              width: 'min(100%, 28rem)',
              color: 'inherit',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--border, #cbd5e1)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'transparent')}
            onChange={(e) => {
              setTitle(e.target.value);
              markDirty();
            }}
          />
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
          <AccessModeCard
            formId={formId}
            authMode={form.data.publication.authMode ?? 'none'}
            hasDepartment={Boolean(form.data.departmentId)}
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
          {allQuestionIdList().length > 1 && (
            <div className="builder-toolbar">
              <button
                type="button"
                className="link-button"
                onClick={() => setExpandedIds(new Set(allQuestionIdList()))}
              >
                باز کردن همه
              </button>
              <button
                type="button"
                className="link-button"
                onClick={() => setExpandedIds(new Set())}
              >
                بستن همه
              </button>
            </div>
          )}
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
                  key={question.id}
                  question={question}
                  index={questionIndex}
                  total={page.questions.length}
                  scoreIndexKeys={indexes}
                  earlierQuestions={earlierQuestions(pageIndex, questionIndex)}
                  dragging={
                    drag?.page === pageIndex && drag.from === questionIndex
                  }
                  dropTarget={
                    drag?.page === pageIndex &&
                    drag.over === questionIndex &&
                    drag.from !== questionIndex
                  }
                  onDragStart={() =>
                    setDrag({
                      page: pageIndex,
                      from: questionIndex,
                      over: questionIndex,
                    })
                  }
                  onDragOverCard={() =>
                    setDrag((d) =>
                      d && d.page === pageIndex && d.over !== questionIndex
                        ? { ...d, over: questionIndex }
                        : d,
                    )
                  }
                  onDropCard={() => {
                    if (drag && drag.page === pageIndex) {
                      reorderQuestion(pageIndex, drag.from, questionIndex);
                    }
                    setDrag(null);
                  }}
                  onDragEnd={() => setDrag(null)}
                  expanded={expandedIds.has(question.id)}
                  onToggleExpand={() => toggleExpanded(question.id)}
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

              <div className="inline-form">
                <AddQuestionMenu
                  onPick={(type) => {
                    const added = newQuestion(nextQuestionNumber(), type);
                    updatePage(pageIndex, {
                      questions: [...page.questions, added],
                    });
                    // سوالِ تازه باز شود تا بی‌درنگ قابلِ ویرایش باشد (بقیه
                    // دست‌نخورده می‌مانند).
                    setExpandedIds((prev) => new Set(prev).add(added.id));
                  }}
                />

                <QuestionBankMenu
                  onPick={(bankQuestions) =>
                    updatePage(pageIndex, {
                      questions: [
                        ...page.questions,
                        ...withFreshIds(bankQuestions, allQuestionIds()),
                      ],
                    })
                  }
                />
              </div>
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
          <DepartmentCard
            formId={formId}
            departmentId={form.data.departmentId ?? null}
          />
          <ThemeEditor formId={formId} settings={form.data.settings} />
          <EdgePagesEditor formId={formId} settings={form.data.settings} />
          <ReminderEditor formId={formId} settings={form.data.settings} />
          <ChecklistEditor
            formId={formId}
            settings={form.data.settings}
            hasDepartment={Boolean(form.data.departmentId)}
          />
          <WorkflowEditor formId={formId} settings={form.data.settings} />
          <BotPublishCard
            formId={formId}
            settings={form.data.settings}
            hasPublication={Boolean(form.data.publication)}
          />
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
          <DisplayRuleEditor
            pages={pages}
            rules={displayRules}
            onChange={(next) => {
              setDisplayRules(next);
              setDirty(true);
            }}
          />

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
