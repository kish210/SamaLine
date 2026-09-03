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
    multiple?: boolean;
    min?: number;
    max?: number;
    step?: number;
    rows?: string[];
    columns?: string[];
    labels?: { start?: string; end?: string };
  };
};

type Page = {
  id: string;
  title: string;
  questions: Question[];
};

type RuleOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'starts_with'
  | 'gt'
  | 'lt'
  | 'between'
  | 'is_empty'
  | 'is_not_empty';

type DisplayRule = {
  targetQuestionId: string;
  sourceQuestionId: string;
  operator: RuleOperator;
  value?: unknown;
};

type SkipRule = {
  fromQuestionId: string;
  toPageId?: string;
  operator?: RuleOperator;
  value?: unknown;
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
      skip?: SkipRule[];
    };
  };
};

const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

function toText(value: unknown) {
  if (value == null) return '';
  if (Array.isArray(value)) return value.join(',');
  return String(value);
}

function evaluateRule(
  operator: RuleOperator,
  current: unknown,
  expected: unknown,
): boolean {
  const currentText = toText(current);
  const expectedText = toText(expected);

  switch (operator) {
    case 'equals':
      return currentText === expectedText;
    case 'not_equals':
      return currentText !== expectedText;
    case 'contains':
      return currentText.includes(expectedText);
    case 'starts_with':
      return currentText.startsWith(expectedText);
    case 'gt':
      return Number(current) > Number(expected);
    case 'lt':
      return Number(current) < Number(expected);
    case 'between': {
      const [min, max] = Array.isArray(expected) ? expected : [null, null];
      const value = Number(current);
      return Number.isFinite(value) && value >= Number(min) && value <= Number(max);
    }
    case 'is_empty':
      return currentText.trim().length === 0;
    case 'is_not_empty':
      return currentText.trim().length > 0;
    default:
      return true;
  }
}

function renderPipedText(
  text: string,
  answers: Record<string, unknown>,
  params: Record<string, string>,
) {
  return text.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, token: string) => {
    if (token.startsWith('param.')) {
      return params[token.slice('param.'.length)] ?? '';
    }
    return toText(answers[token]);
  });
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
  const [hiddenParams, setHiddenParams] = useState<Record<string, string>>({});

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hidden: Record<string, string> = {};
    params.forEach((value, key) => {
      if (!['respondentKey', 'lang'].includes(key)) hidden[key] = value;
    });
    setHiddenParams(hidden);
    const key = params.get('respondentKey');
    if (key) setRespondentKey(key);
    const qsLang = params.get('lang');
    if (qsLang) setLang(qsLang);
  }, []);

  useEffect(() => {
    if (!token) return;
    void axios.get(`${apiBase}/public/forms/${token}`).then((res) => {
      setData(res.data);
      const settings = res.data.settings ?? {};
      const languages = Array.isArray(settings.languages)
        ? settings.languages
        : ['fa'];
      if (!window.location.search.includes('lang=')) {
        setLang(String(languages[0] ?? 'fa'));
      }
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
        meta: { respondentKey, lang, hidden_params: hiddenParams },
      });
    }, 500);

    return () => clearTimeout(timeout);
  }, [answers, data, hiddenParams, lang, respondentKey, token, view]);

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
      return relatedRules.every((rule) =>
        evaluateRule(rule.operator, answers[rule.sourceQuestionId], rule.value),
      );
    });
  }, [answers, currentPage, data]);

  const getNextPageIndex = () => {
    const skipRules = data?.structure.logic?.skip ?? [];
    for (const rule of skipRules) {
      const currentValue = answers[rule.fromQuestionId];
      const match = rule.operator
        ? evaluateRule(rule.operator, currentValue, rule.value)
        : currentValue != null && toText(currentValue).trim() !== '';
      if (match && rule.toPageId) {
        const targetIndex = pages.findIndex((p) => p.id === rule.toPageId);
        if (targetIndex >= 0) return targetIndex;
      }
    }
    return pageIndex + 1;
  };

  const renderQuestionTitle = (question: Question) => {
    const translated = question.meta?.translations?.[lang];
    const base = translated || question.title;
    return renderPipedText(base, answers, hiddenParams);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;

    const nextPageIndex = getNextPageIndex();
    if (nextPageIndex < pages.length && nextPageIndex !== pageIndex) {
      setPageIndex(nextPageIndex);
      return;
    }
    if (pageIndex < pages.length - 1) {
      setPageIndex((prev) => prev + 1);
      return;
    }

    void axios
      .post(`${apiBase}/public/forms/${token}/submit`, {
        respondentKey,
        answers,
        meta: { respondentKey, lang, hidden_params: hiddenParams },
      })
      .then(() => {
        setDone(true);
        setView('end');
      });
  };

  const toggleMultiChoice = (qid: string, option: string, checked: boolean) => {
    setAnswers((prev) => {
      const current = Array.isArray(prev[qid]) ? (prev[qid] as string[]) : [];
      const next = checked
        ? Array.from(new Set([...current, option]))
        : current.filter((item) => item !== option);
      return { ...prev, [qid]: next };
    });
  };

  const setMatrixValue = (qid: string, row: string, value: string) => {
    setAnswers((prev) => {
      const matrix = (prev[qid] as Record<string, string> | undefined) ?? {};
      return { ...prev, [qid]: { ...matrix, [row]: value } };
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
            <div key={q.id} style={{ marginBottom: 16 }}>
              <label>{renderQuestionTitle(q)}</label>
              {q.type === 'static_text' ? (
                <p>{q.meta?.translations?.[lang] ?? q.title}</p>
              ) : q.type === 'long_text' ? (
                <textarea
                  required={q.required}
                  value={String(answers[q.id] ?? '')}
                  onChange={(e) =>
                    setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                  }
                />
              ) : q.type === 'multiple_choice' && q.meta?.multiple ? (
                <div>
                  {(q.options ?? []).map((option) => {
                    const selected = Array.isArray(answers[q.id])
                      ? (answers[q.id] as string[]).includes(option)
                      : false;
                    return (
                      <label key={option} className="row">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={(e) =>
                            toggleMultiChoice(q.id, option, e.target.checked)
                          }
                        />
                        {option}
                      </label>
                    );
                  })}
                </div>
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
              ) : q.type === 'boolean' ? (
                <select
                  required={q.required}
                  value={String(answers[q.id] ?? '')}
                  onChange={(e) =>
                    setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                  }
                >
                  <option value="">انتخاب کنید</option>
                  <option value="yes">بله</option>
                  <option value="no">خیر</option>
                </select>
              ) : q.type === 'rating' || q.type === 'slider' || q.type === 'nps' ? (
                <div>
                  <input
                    type="range"
                    min={q.type === 'nps' ? 0 : q.meta?.min ?? 1}
                    max={q.type === 'nps' ? 10 : q.meta?.max ?? 5}
                    step={q.meta?.step ?? 1}
                    value={Number(answers[q.id] ?? (q.type === 'nps' ? 0 : 1))}
                    onChange={(e) =>
                      setAnswers((prev) => ({ ...prev, [q.id]: Number(e.target.value) }))
                    }
                  />
                  <small>
                    {q.meta?.labels?.start ?? 'کم'} - {q.meta?.labels?.end ?? 'زیاد'} :{' '}
                    {String(answers[q.id] ?? (q.type === 'nps' ? 0 : 1))}
                  </small>
                </div>
              ) : q.type === 'matrix' ? (
                <div>
                  {(q.meta?.rows ?? ['row_1']).map((row) => (
                    <div key={row} className="row">
                      <span style={{ minWidth: 120 }}>{row}</span>
                      <select
                        value={String(
                          ((answers[q.id] as Record<string, string> | undefined) ?? {})[
                            row
                          ] ?? '',
                        )}
                        onChange={(e) => setMatrixValue(q.id, row, e.target.value)}
                      >
                        <option value="">انتخاب</option>
                        {(q.meta?.columns ?? q.options ?? ['1', '2', '3', '4', '5']).map(
                          (column) => (
                            <option key={column} value={column}>
                              {column}
                            </option>
                          ),
                        )}
                      </select>
                    </div>
                  ))}
                </div>
              ) : q.type === 'ranking' ? (
                <textarea
                  required={q.required}
                  value={String(answers[q.id] ?? '')}
                  placeholder="گزینه‌ها را به ترتیب و با ویرگول وارد کنید"
                  onChange={(e) =>
                    setAnswers((prev) => ({
                      ...prev,
                      [q.id]: e.target.value
                        .split(',')
                        .map((item) => item.trim())
                        .filter(Boolean),
                    }))
                  }
                />
              ) : q.type === 'date' ? (
                <input
                  type="date"
                  required={q.required}
                  value={String(answers[q.id] ?? '')}
                  onChange={(e) =>
                    setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                  }
                />
              ) : ['file_upload', 'camera', 'audio_record', 'signature', 'location'].includes(
                  q.type,
                ) ? (
                <textarea
                  required={q.required}
                  value={String(answers[q.id] ?? '')}
                  placeholder="مقدار JSON/URL این فیلد را وارد کنید"
                  onChange={(e) =>
                    setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                  }
                />
              ) : (
                <input
                  type={
                    q.type === 'number'
                      ? 'number'
                      : q.type === 'email'
                        ? 'email'
                        : q.type === 'url'
                          ? 'url'
                          : 'text'
                  }
                  required={q.required}
                  min={q.meta?.min}
                  max={q.meta?.max}
                  step={q.meta?.step}
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
