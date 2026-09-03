import axios from 'axios';
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';

type Question = {
  id: string;
  title: string;
  type: string;
  required?: boolean;
  options?: string[];
  meta?: {
    translations?: Record<string, string>;
  };
};

type Page = {
  id: string;
  title: string;
  questions: Question[];
};

type DisplayRule = {
  targetQuestionId: string;
  sourceQuestionId: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'is_empty' | 'is_not_empty';
  value?: string;
};

type PublicForm = {
  publicationId: string;
  formTitle: string;
  settings: {
    languages?: string[];
    startPageEnabled?: boolean;
    endPageEnabled?: boolean;
    startPageText?: string;
    endPageText?: string;
    saveProgress?: boolean;
  };
  structure: {
    pages?: Page[];
    logic?: {
      display?: DisplayRule[];
    };
  };
};

const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

function evaluateRule(rule: DisplayRule, answers: Record<string, unknown>) {
  const current = answers[rule.sourceQuestionId];
  const currentText = current == null ? '' : String(current);

  switch (rule.operator) {
    case 'equals':
      return currentText === String(rule.value ?? '');
    case 'not_equals':
      return currentText !== String(rule.value ?? '');
    case 'contains':
      return currentText.includes(String(rule.value ?? ''));
    case 'is_empty':
      return currentText.trim().length === 0;
    case 'is_not_empty':
      return currentText.trim().length > 0;
    default:
      return true;
  }
}

function FormPage() {
  const { token } = useParams();
  const { t } = useTranslation();
  const [data, setData] = useState<PublicForm | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [respondentKey, setRespondentKey] = useState('');
  const [done, setDone] = useState(false);
  const [view, setView] = useState<'start' | 'form' | 'end'>('start');
  const [pageIndex, setPageIndex] = useState(0);
  const [lang, setLang] = useState('fa');

  useEffect(() => {
    if (!token) return;
    void axios.get(`${apiBase}/public/forms/${token}`).then((res) => {
      setData(res.data);
      const settings = res.data.settings ?? {};
      const languages = Array.isArray(settings.languages)
        ? settings.languages
        : ['fa'];
      setLang(String(languages[0] ?? 'fa'));
      setView(settings.startPageEnabled === false ? 'form' : 'start');
    });
  }, [token]);

  useEffect(() => {
    if (!token || !respondentKey) return;
    void axios
      .get(`${apiBase}/public/forms/${token}/progress/${encodeURIComponent(respondentKey)}`)
      .then((res) => {
        if (res.data?.exists) {
          setAnswers(res.data.answers ?? {});
          setView('form');
        }
      });
  }, [token, respondentKey]);

  useEffect(() => {
    if (!data || !token || !respondentKey) return;
    if (data.settings?.saveProgress === false) return;
    if (view !== 'form') return;

    const timeout = setTimeout(() => {
      void axios.post(`${apiBase}/public/forms/${token}/save-progress`, {
        respondentKey,
        answers,
        meta: { respondentKey, lang },
      });
    }, 500);

    return () => clearTimeout(timeout);
  }, [answers, data, lang, respondentKey, token, view]);

  const pages = useMemo(() => data?.structure.pages ?? [], [data]);
  const currentPage = pages[pageIndex];

  const visibleQuestions = useMemo(() => {
    const displayRules = data?.structure.logic?.display ?? [];
    if (!currentPage) return [];

    return currentPage.questions.filter((question) => {
      const relatedRules = displayRules.filter(
        (rule) => rule.targetQuestionId === question.id,
      );
      if (!relatedRules.length) return true;
      return relatedRules.every((rule) => evaluateRule(rule, answers));
    });
  }, [answers, currentPage, data]);

  const renderQuestionTitle = (question: Question) => {
    const translated = question.meta?.translations?.[lang];
    return translated || question.title;
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;

    if (pageIndex < pages.length - 1) {
      setPageIndex((prev) => prev + 1);
      return;
    }

    void axios
      .post(`${apiBase}/public/forms/${token}/submit`, {
        respondentKey,
        answers,
        meta: { respondentKey, lang },
      })
      .then(() => {
        setDone(true);
        setView('end');
      });
  };

  if (!token) return <div className="container">توکن فرم نامعتبر است.</div>;
  if (!data) return <div className="container">{t('loading')}</div>;
  if (done && view === 'end') {
    return (
      <div className="container">
        <h2>{data.settings?.endPageText || t('done')}</h2>
      </div>
    );
  }

  return (
    <div className="container">
      <h2>{data.formTitle}</h2>

      {view === 'start' && (
        <div>
          <p>{data.settings?.startPageText || 'به فرم خوش آمدید'}</p>
          <input
            value={respondentKey}
            onChange={(e) => setRespondentKey(e.target.value)}
            placeholder="شناسه پاسخ‌دهنده (برای ذخیره پیشرفت)"
          />
          <select value={lang} onChange={(event) => setLang(event.target.value)}>
            {(data.settings?.languages ?? ['fa']).map((lng) => (
              <option key={lng} value={lng}>
                {lng}
              </option>
            ))}
          </select>
          <button onClick={() => setView('form')}>شروع پاسخ‌دهی</button>
        </div>
      )}

      {view === 'form' && currentPage && (
        <form onSubmit={handleSubmit}>
          <h3>{currentPage.title}</h3>

          {visibleQuestions.map((q) => (
            <div key={q.id}>
              <label>{renderQuestionTitle(q)}</label>
              {q.type === 'long_text' ? (
                <textarea
                  required={q.required}
                  value={String(answers[q.id] ?? '')}
                  onChange={(e) =>
                    setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                  }
                />
              ) : q.type === 'multiple_choice' || q.type === 'dropdown' ? (
                <select
                  required={q.required}
                  value={String(answers[q.id] ?? '')}
                  onChange={(e) =>
                    setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                  }
                >
                  <option value="">انتخاب کنید</option>
                  {(q.options ?? []).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={q.type === 'number' ? 'number' : q.type === 'email' ? 'email' : 'text'}
                  required={q.required}
                  value={String(answers[q.id] ?? '')}
                  onChange={(e) =>
                    setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                  }
                />
              )}
            </div>
          ))}

          {pageIndex > 0 && (
            <button type="button" onClick={() => setPageIndex((prev) => prev - 1)}>
              صفحه قبل
            </button>
          )}
          <button type="submit">
            {pageIndex < pages.length - 1 ? 'ادامه' : t('submit')}
          </button>
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
