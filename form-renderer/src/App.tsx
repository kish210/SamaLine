import type { FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { LanguagePicker } from './LanguagePicker';
import { PlatformFooter } from './PlatformFooter';
import { PublicDashboard } from './PublicDashboard';
import { QuestionField } from './QuestionField';
import { RespondentAuth } from './RespondentAuth';
import { useFormFlow } from './useFormFlow';
import { firstInvalid, validateAnswer } from './validate';
import { useTheme } from './useTheme';

/**
 * صفحه‌ی فرم.
 *
 * جریان پاسخ‌دهی اینجا ساخته می‌شود تا نوار پایین سکو بتواند در همه‌ی
 * حالت‌ها (شروع، فرم، پایان، خطا) دیده شود؛ بدنه‌ی فرم چند خروجی زودهنگام
 * دارد و نوار نباید به یکی از آن‌ها گره بخورد.
 */
function FormPage() {
  const { token } = useParams();
  const flow = useFormFlow(token);

  return (
    <>
      <FormBody token={token} flow={flow} />
      <PlatformFooter footer={flow.form?.footer} />
    </>
  );
}

interface FormBodyProps {
  token: string | undefined;
  flow: ReturnType<typeof useFormFlow>;
}

function FormBody({ token, flow }: FormBodyProps) {
  const { t } = useTranslation();
  const startedRef = useRef(false);
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /*
   * جهت آخرین جابه‌جایی، برای انیمیشن ورود.
   *
   * در iOS رفتن به جلو از یک سمت می‌آید و بازگشت از سمت مقابل؛ همین یک
   * نشانه، حس «کجای مسیر هستم» را می‌دهد.
   */
  const [direction, setDirection] = useState<'forward' | 'back'>('forward');
  /*
   * خطای اعتبارسنجی سوال‌های همین گام.
   *
   * فقط بعد از تلاش برای رفتن به گام بعد نشان داده می‌شود؛ نشان دادن خطا
   * حین تایپ، پیش از آنکه کاربر تمام کند، آزاردهنده است.
   */
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  useTheme(flow.form?.theme);

  // در حالت تک‌سوالی، شماره‌ی سوال جاری درون صفحه.
  const [questionIndex, setQuestionIndex] = useState(0);
  const oneAtATime = Boolean(flow.form?.theme?.oneQuestionPerStep);
  const questions = flow.page?.questions ?? [];
  // با عوض شدن صفحه، از سوال اول همان صفحه شروع می‌کنیم.
  const pageId = flow.page?.id;
  useEffect(() => setQuestionIndex(0), [pageId]);

  const visibleQuestions = oneAtATime
    ? questions.slice(questionIndex, questionIndex + 1)
    : questions;
  const isLastQuestionOfPage =
    !oneAtATime || questionIndex >= questions.length - 1;

  // وقتی صفحه‌ی شروع غیرفعال است، خودکار وارد فرم می‌شویم.
  useEffect(() => {
    if (flow.view === 'form' && !flow.page && !startedRef.current) {
      startedRef.current = true;
      void flow.loadFirstPage();
    }
  }, [flow]);

  // تغییر پاسخ ممکن است سوالی را در همین صفحه فعال یا غیرفعال کند؛
  // صفحه با تاخیر کوتاه از سرور تازه می‌شود.
  const answersKey = JSON.stringify(flow.answers);
  useEffect(() => {
    if (flow.view !== 'form' || !flow.page) return;
    const timer = setTimeout(() => void flow.refreshPage(), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answersKey]);

  /**
   * رفتن به گام بعد.
   *
   * فرم `noValidate` است تا اعتبارسنجی بومی مرورگر جلوی submit را نگیرد؛
   * وگرنه این تابع اصلا اجرا نمی‌شود و به‌جای پیام فارسی ما، یک تولتیپ
   * انگلیسی مرورگر نشان داده می‌شود.
   */
  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    // در حالت تک‌سوالی، تا وقتی سوال بعدی در همین صفحه هست به سرور
    // نمی‌رویم؛ منطق پرش فقط بین صفحات معنا دارد.
    // سوال‌های همین گام پیش از رفتن جلو سنجیده می‌شوند.
    const invalid = firstInvalid(visibleQuestions, flow.answers);
    if (invalid) {
      setFieldErrors({ [invalid.questionId]: invalid.message });
      return;
    }
    setFieldErrors({});

    setDirection('forward');
    if (!isLastQuestionOfPage) {
      setQuestionIndex((prev) => prev + 1);
      return;
    }

    const step = await flow.goNext();
    if (step?.finished) await flow.submit();
  };

  /**
   * رفتن خودکار به سوال بعد پس از یک انتخاب قطعی.
   *
   * فقط در حالت تک‌سوالی معنا دارد و فقط وقتی سوال اجباری نیست یا مقداری
   * انتخاب شده؛ مکث کوتاه برای این است که پاسخ‌دهنده انتخابش را ببیند.
   */
  const autoAdvance = () => {
    if (!oneAtATime || flow.loading) return;
    // مقدار نامعتبر نباید با رفتن خودکار از قلم بیفتد.
    if (firstInvalid(visibleQuestions, flow.answers)) return;
    setDirection('forward');
    if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    autoTimerRef.current = setTimeout(() => {
      if (isLastQuestionOfPage) {
        void (async () => {
          const step = await flow.goNext();
          if (step?.finished) await flow.submit();
        })();
      } else {
        setQuestionIndex((prev) => prev + 1);
      }
    }, 350);
  };

  // با ترک صفحه، تایمر معلق نباید اجرا شود.
  useEffect(
    () => () => {
      if (autoTimerRef.current) clearTimeout(autoTimerRef.current);
    },
    [],
  );

  const handleBack = async () => {
    setFieldErrors({});
    setDirection('back');
    if (oneAtATime && questionIndex > 0) {
      setQuestionIndex((prev) => prev - 1);
      return;
    }
    await flow.goBack();
  };

  if (!token) return <div className="container">توکن فرم نامعتبر است.</div>;

  // فرم رمزدار یا کددار تا پیش از ورود، محتوایی نشان نمی‌دهد.
  if (flow.authMode && !flow.authenticated) {
    return (
      <RespondentAuth
        token={token}
        authMode={flow.authMode}
        onAuthenticated={flow.markAuthenticated}
      />
    );
  }

  if (flow.error) return <div className="container error">{flow.error}</div>;
  if (!flow.form) return <div className="container">{t('loading')}</div>;

  if (flow.view === 'end') {
    return (
      <div className="container">
        {flow.form.theme?.logoUrl && (
          <img className="form-logo" src={flow.form.theme.logoUrl} alt="" />
        )}
        <h2>{flow.form.settings?.endPageText || t('done')}</h2>
        {flow.pendingCount > 0 && (
          <p className="hint">
            پاسخ شما به‌دلیل قطعی شبکه روی همین دستگاه ذخیره شد و با برقراری
            اتصال خودکار ارسال می‌شود.
          </p>
        )}
        {Object.keys(flow.scores).length > 0 && (
          <ul className="scores">
            {Object.entries(flow.scores).map(([key, value]) => (
              <li key={key}>
                {key}: <strong>{value}</strong>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className={oneAtATime ? 'container centered' : 'container'}>
      {flow.form.theme?.logoUrl && (
        <img className="form-logo" src={flow.form.theme.logoUrl} alt="" />
      )}
      <h2>{flow.form.formTitle}</h2>

      {flow.view === 'start' && (
        <div className="start-page">
          <p>{flow.form.settings?.startPageText || 'به فرم خوش آمدید'}</p>

          <LanguagePicker
            languages={flow.form.settings?.languages ?? ['fa']}
            value={flow.lang}
            onChange={flow.setLang}
          />

          <button
            type="button"
            disabled={flow.loading}
            onClick={() => void flow.loadFirstPage()}
          >
            شروع پاسخ‌دهی
          </button>
        </div>
      )}

      {flow.view === 'form' && flow.page && (
        <form noValidate onSubmit={handleSubmit}>
          {flow.progress !== null && !oneAtATime && (
            <div className="progress-row">
              <div
                className="progress"
                role="progressbar"
                aria-valuenow={flow.progress}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  className="progress-fill"
                  style={{ width: `${flow.progress}%` }}
                />
              </div>
              {oneAtATime && questions.length > 0 && (
                <span className="progress-counter">
                  {questionIndex + 1}/{questions.length}
                </span>
              )}
            </div>
          )}

          {/*
            کلید شامل صفحه و شماره‌ی سوال است؛ با هر جابه‌جایی، React این
            بخش را از نو می‌سازد و انیمیشن ورود دوباره اجرا می‌شود.
          */}
          <div
            key={`${flow.page.id}:${questionIndex}`}
            className={`step-panel enter-${direction}`}
          >
            <h3>{flow.page.title}</h3>

            {visibleQuestions.map((question) => (
              <div key={question.id} className="question">
                <label htmlFor={question.id}>
                  {question.required && (
                    <span className="required-star" aria-hidden="true">
                      *
                    </span>
                  )}
                  {question.title}
                </label>
                {question.description && (
                  <small className="description">{question.description}</small>
                )}
                {question.meta?.imageUrl && (
                  <img
                    className="question-image"
                    src={question.meta.imageUrl}
                    alt=""
                  />
                )}
                <QuestionField
                  question={question}
                  value={flow.answers[question.id]}
                  lang={flow.lang}
                  onChange={(value) => {
                    flow.setAnswer(question.id, value);
                    // به‌محض درست شدن مقدار، خطا برداشته می‌شود.
                    if (
                      fieldErrors[question.id] &&
                      !validateAnswer(question, value)
                    ) {
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next[question.id];
                        return next;
                      });
                    }
                  }}
                  onCommit={autoAdvance}
                />
                {fieldErrors[question.id] && (
                  <p className="field-error" role="alert">
                    {fieldErrors[question.id]}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className={oneAtATime ? 'actions bottom-bar' : 'actions'}>
            {oneAtATime && flow.progress !== null && (
              <div className="bottom-progress">
                <div
                  className="progress"
                  role="progressbar"
                  aria-valuenow={flow.progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="progress-fill"
                    style={{ width: `${flow.progress}%` }}
                  />
                </div>
                {questions.length > 0 && (
                  <span className="progress-counter">
                    {questionIndex + 1}/{questions.length}
                  </span>
                )}
              </div>
            )}
            {(flow.canGoBack || (oneAtATime && questionIndex > 0)) && (
              <button
                type="button"
                disabled={flow.loading}
                onClick={() => void handleBack()}
              >
                قبلی
              </button>
            )}
            <button type="submit" disabled={flow.loading}>
              {flow.loading
                ? '...'
                : isLastQuestionOfPage
                  ? t('submit')
                  : 'بعدی'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/f/:token" element={<FormPage />} />
      <Route path="/d/:publicToken" element={<PublicDashboard />} />
      <Route path="*" element={<Navigate to="/f/demo" replace />} />
    </Routes>
  );
}

export default App;
