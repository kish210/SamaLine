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
};

type PublicForm = {
  formTitle: string;
  structure: {
    pages?: Array<{ questions?: Question[] }>;
  };
};

function FormPage() {
  const { token } = useParams();
  const { t } = useTranslation();
  const [data, setData] = useState<PublicForm | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [done, setDone] = useState(false);

  const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

  useEffect(() => {
    if (!token) return;
    void axios.get(`${apiBase}/public/forms/${token}`).then((res) => setData(res.data));
  }, [token, apiBase]);

  const questions = useMemo(() => data?.structure.pages?.[0]?.questions ?? [], [data]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;

    void axios
      .post(`${apiBase}/public/forms/${token}/submit`, { answers })
      .then(() => setDone(true));
  };

  if (!token) return <div className="container">توکن فرم نامعتبر است.</div>;
  if (!data) return <div className="container">{t('loading')}</div>;
  if (done) return <div className="container">{t('done')}</div>;

  return (
    <div className="container">
      <h2>{data.formTitle}</h2>
      <form onSubmit={onSubmit}>
        {questions.map((q) => (
          <div key={q.id}>
            <label>{q.title}</label>
            {q.type === 'long_text' ? (
              <textarea
                required={q.required}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
              />
            ) : q.type === 'multiple_choice' || q.type === 'dropdown' ? (
              <select
                required={q.required}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
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
                onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
              />
            )}
          </div>
        ))}
        <button type="submit">{t('submit')}</button>
      </form>
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
