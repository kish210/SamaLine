import type { FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { PublicDashboard } from './PublicDashboard';
import { QuestionField } from './QuestionField';
import { RespondentAuth } from './RespondentAuth';
import { useFormFlow } from './useFormFlow';
import { useTheme } from './useTheme';

function FormPage() {
  const { token } = useParams();
  const { t } = useTranslation();
  const flow = useFormFlow(token);
  const startedRef = useRef(false);
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

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    // در حالت تک‌سوالی، تا وقتی سوال بعدی در همین صفحه هست به سرور
    // نمی‌رویم؛ منطق پرش فقط بین صفحات معنا دارد.
    if (!isLastQuestionOfPage) {
      setQuestionIndex((prev) => prev + 1);
      return;
    }

    const step = await flow.goNext();
    if (step?.finished) await flow.submit();
  };

  const handleBack = async () => {
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
    <div className="container">
      {flow.form.theme?.logoUrl && (
        <img className="form-logo" src={flow.form.theme.logoUrl} alt="" />
      )}
      <h2>{flow.form.formTitle}</h2>

      {flow.view === 'start' && (
        <div className="start-page">
          <p>{flow.form.settings?.startPageText || 'به فرم خوش آمدید'}</p>
          <input
            value={flow.respondentKey}
            onChange={(e) => flow.setRespondentKey(e.target.value)}
            placeholder="شناسه پاسخ‌دهنده (برای ذخیره پیشرفت)"
          />
          <select
            value={flow.lang}
            onChange={(event) => flow.setLang(event.target.value)}
          >
            {(flow.form.settings?.languages ?? ['fa']).map((lng) => (
              <option key={lng} value={lng}>
                {lng}
              </option>
            ))}
          </select>
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
        <form onSubmit={handleSubmit}>
          {flow.progress !== null && (
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
              <QuestionField
                question={question}
                value={flow.answers[question.id]}
                lang={flow.lang}
                onChange={(value) => flow.setAnswer(question.id, value)}
              />
            </div>
          ))}

          <div className="actions">
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
