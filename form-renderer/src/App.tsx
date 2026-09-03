import type { FormEvent } from 'react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { QuestionField } from './QuestionField';
import { useFormFlow } from './useFormFlow';

function FormPage() {
  const { token } = useParams();
  const { t } = useTranslation();
  const flow = useFormFlow(token);
  const startedRef = useRef(false);

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
    const step = await flow.goNext();
    if (step?.finished) await flow.submit();
  };

  if (!token) return <div className="container">توکن فرم نامعتبر است.</div>;
  if (flow.error) return <div className="container error">{flow.error}</div>;
  if (!flow.form) return <div className="container">{t('loading')}</div>;

  if (flow.view === 'end') {
    return (
      <div className="container">
        <h2>{flow.form.settings?.endPageText || t('done')}</h2>
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
          <h3>{flow.page.title}</h3>

          {flow.page.questions.map((question) => (
            <div key={question.id} className="question">
              <label htmlFor={question.id}>{question.title}</label>
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
            {flow.canGoBack && (
              <button
                type="button"
                disabled={flow.loading}
                onClick={() => void flow.goBack()}
              >
                صفحه قبل
              </button>
            )}
            <button type="submit" disabled={flow.loading}>
              {flow.loading ? '...' : t('submit')}
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
      <Route path="*" element={<Navigate to="/f/demo" replace />} />
    </Routes>
  );
}

export default App;
