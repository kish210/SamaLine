import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { api, setAuthToken } from './api';

type AuthPayload = {
  accessToken: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    organizationId?: string;
    workspaceId?: string;
  };
};

type Question = {
  id: string;
  title: string;
  type:
    | 'short_text'
    | 'long_text'
    | 'email'
    | 'url'
    | 'phone'
    | 'mobile'
    | 'number'
    | 'boolean'
    | 'multiple_choice'
    | 'dropdown';
  options?: string[];
  required?: boolean;
};

const QUESTION_TYPES: Question['type'][] = [
  'short_text',
  'long_text',
  'email',
  'url',
  'phone',
  'mobile',
  'number',
  'boolean',
  'multiple_choice',
  'dropdown',
];

function App() {
  const { t } = useTranslation();
  const [token, setToken] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string>('');
  const [organizationId, setOrganizationId] = useState<string>('');
  const [activeFormId, setActiveFormId] = useState<string>('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [pageTitlesInput, setPageTitlesInput] = useState('صفحه ۱');
  const [preventDuplicate, setPreventDuplicate] = useState(false);
  const [saveProgress, setSaveProgress] = useState(true);
  const [startPageText, setStartPageText] = useState('به نظرسنجی خوش آمدید');
  const [endPageText, setEndPageText] = useState('از مشارکت شما سپاسگزاریم');
  const [languagesInput, setLanguagesInput] = useState('fa');
  const [aiGoal, setAiGoal] = useState('افزایش رضایت مشتریان شعب');
  const [aiResult, setAiResult] = useState<Record<string, unknown> | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterRespondentKey, setFilterRespondentKey] = useState('');
  const [filterQuestionId, setFilterQuestionId] = useState('');
  const [filterValueText, setFilterValueText] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [savedFilterName, setSavedFilterName] = useState('فیلتر پیش‌فرض');
  const [selectedResponseId, setSelectedResponseId] = useState('');
  const [commentAuthorName, setCommentAuthorName] = useState('تحلیلگر');
  const [commentBody, setCommentBody] = useState('');

  const registerMutation = useMutation({
    mutationFn: (payload: Record<string, string>) => api.post<AuthPayload>('/auth/register', payload),
    onSuccess: ({ data }) => {
      setToken(data.accessToken);
      setAuthToken(data.accessToken);
      setWorkspaceId(data.user.workspaceId ?? '');
      setOrganizationId(data.user.organizationId ?? '');
    },
  });

  const loginMutation = useMutation({
    mutationFn: (payload: Record<string, string>) => api.post<AuthPayload>('/auth/login', payload),
    onSuccess: ({ data }) => {
      setToken(data.accessToken);
      setAuthToken(data.accessToken);
      setWorkspaceId(data.user.workspaceId ?? '');
      setOrganizationId(data.user.organizationId ?? '');
    },
  });

  const formsQuery = useQuery({
    queryKey: ['forms', workspaceId, token],
    queryFn: async () => (await api.get('/forms', { params: { workspaceId } })).data,
    enabled: Boolean(token && workspaceId),
  });

  const responsesQuery = useQuery({
    queryKey: [
      'responses',
      activeFormId,
      token,
      filterStatus,
      filterRespondentKey,
      filterQuestionId,
      filterValueText,
      filterDateFrom,
      filterDateTo,
    ],
    queryFn: async () =>
      (
        await api.get(`/responses/form/${activeFormId}`, {
          params: {
            status: filterStatus || undefined,
            respondentKey: filterRespondentKey || undefined,
            questionId: filterQuestionId || undefined,
            valueText: filterValueText || undefined,
            dateFrom: filterDateFrom || undefined,
            dateTo: filterDateTo || undefined,
          },
        })
      ).data,
    enabled: Boolean(token && activeFormId),
  });

  const createFormMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/forms', payload),
    onSuccess: () => formsQuery.refetch(),
  });

  const publishMutation = useMutation({
    mutationFn: (formId: string) => api.post(`/forms/${formId}/publish-link`),
    onSuccess: () => formsQuery.refetch(),
  });

  const exportUrl = useMemo(() => {
    if (!activeFormId) return '#';
    return `${import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1'}/responses/form/${activeFormId}/export`;
  }, [activeFormId]);

  const summaryQuery = useQuery({
    queryKey: ['summary', activeFormId, token],
    queryFn: async () => (await api.get(`/reports/forms/${activeFormId}/summary`)).data,
    enabled: Boolean(token && activeFormId),
  });

  const savedFiltersQuery = useQuery({
    queryKey: ['saved-filters', workspaceId, token],
    queryFn: async () =>
      (
        await api.get('/reports/filters', {
          params: { workspaceId },
        })
      ).data,
    enabled: Boolean(token && workspaceId),
  });

  const commentsQuery = useQuery({
    queryKey: ['comments', selectedResponseId, token],
    queryFn: async () =>
      (await api.get(`/responses/${selectedResponseId}/comments`)).data,
    enabled: Boolean(token && selectedResponseId),
  });

  const saveFilterMutation = useMutation({
    mutationFn: () =>
      api.post('/reports/filters', {
        workspaceId,
        name: savedFilterName,
        definition: {
          status: filterStatus,
          respondentKey: filterRespondentKey,
          questionId: filterQuestionId,
          valueText: filterValueText,
          dateFrom: filterDateFrom,
          dateTo: filterDateTo,
        },
      }),
    onSuccess: () => savedFiltersQuery.refetch(),
  });

  const addCommentMutation = useMutation({
    mutationFn: () =>
      api.post(`/responses/${selectedResponseId}/comments`, {
        authorName: commentAuthorName,
        body: commentBody,
      }),
    onSuccess: () => {
      setCommentBody('');
      commentsQuery.refetch();
    },
  });

  if (!token) {
    return (
      <div className="container">
        <h1>{t('appTitle')}</h1>
        <div className="grid2">
          <div className="card">
            <h3>{t('register')}</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                registerMutation.mutate({
                  fullName: String(formData.get('fullName') ?? ''),
                  email: String(formData.get('email') ?? ''),
                  password: String(formData.get('password') ?? ''),
                  organizationName: String(formData.get('organizationName') ?? ''),
                  workspaceName: String(formData.get('workspaceName') ?? ''),
                });
              }}
            >
              <input name="fullName" placeholder={t('fullName')} required />
              <input name="email" placeholder={t('email')} type="email" required />
              <input name="password" placeholder={t('password')} type="password" required />
              <input name="organizationName" placeholder={t('orgName')} required />
              <input name="workspaceName" placeholder={t('workspaceName')} required />
              <button type="submit">{t('register')}</button>
            </form>
          </div>
          <div className="card">
            <h3>{t('login')}</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                loginMutation.mutate({
                  email: String(formData.get('email') ?? ''),
                  password: String(formData.get('password') ?? ''),
                });
              }}
            >
              <input name="email" placeholder={t('email')} type="email" required />
              <input name="password" placeholder={t('password')} type="password" required />
              <button type="submit">{t('login')}</button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const addQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        id: `q_${prev.length + 1}`,
        title: `سوال ${prev.length + 1}`,
        type: 'short_text',
      },
    ]);
  };

  const submitFormBuilder = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const pageTitles = pageTitlesInput
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
    const normalizedPageTitles = pageTitles.length ? pageTitles : ['صفحه ۱'];
    const pages = normalizedPageTitles.map((title, index) => ({
      id: `page_${index + 1}`,
      title,
      questions: [] as Question[],
    }));
    questions.forEach((question, index) => {
      const pageIndex = Math.min(index, pages.length - 1);
      pages[pageIndex].questions.push(question);
    });

    createFormMutation.mutate({
      workspaceId,
      title: String(formData.get('title') ?? ''),
      slug: String(formData.get('slug') ?? ''),
      pages,
      settings: {
        theme: 'default',
        languages: languagesInput
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        startPageEnabled: true,
        endPageEnabled: true,
        startPageText,
        endPageText,
        preventDuplicate,
        saveProgress,
      },
    });
  };

  return (
    <div className="container">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>{t('appTitle')}</h1>
        <button
          className="secondary"
          onClick={() => {
            setToken(null);
            setAuthToken();
          }}
        >
          {t('logout')}
        </button>
      </div>

      <div className="card">
        <h3>{t('phaseStatus')}</h3>
        <ul>
          <li>فاز ۱: انجام شد</li>
          <li>فاز ۲ تا ۱۰: زیرساخت اولیه API اضافه شد</li>
          <li>یادداشت ممیزی: ایرادها در todo.md ثبت می‌شود</li>
        </ul>
      </div>

      <div className="card">
        <h3>{t('createForm')}</h3>
        <form onSubmit={submitFormBuilder}>
          <input name="title" placeholder={t('title')} required />
          <input name="slug" placeholder={t('slug')} required />
          <textarea
            value={pageTitlesInput}
            onChange={(event) => setPageTitlesInput(event.target.value)}
            placeholder="عنوان صفحه‌ها (هر خط یک صفحه)"
          />
          <input value={languagesInput} onChange={(event) => setLanguagesInput(event.target.value)} placeholder="fa,en,ar" />
          <input value={startPageText} onChange={(event) => setStartPageText(event.target.value)} placeholder="متن شروع" />
          <input value={endPageText} onChange={(event) => setEndPageText(event.target.value)} placeholder="متن پایان" />
          <label className="row">
            <input
              type="checkbox"
              checked={preventDuplicate}
              onChange={(event) => setPreventDuplicate(event.target.checked)}
            />
            جلوگیری از پاسخ تکراری
          </label>
          <label className="row">
            <input
              type="checkbox"
              checked={saveProgress}
              onChange={(event) => setSaveProgress(event.target.checked)}
            />
            ذخیره پیشرفت
          </label>
          <button type="button" className="secondary" onClick={addQuestion}>
            افزودن سوال
          </button>
          {questions.map((q, idx) => (
            <div key={q.id} className="row">
              <input
                value={q.title}
                onChange={(event) => {
                  const value = event.target.value;
                  setQuestions((prev) => prev.map((item, i) => (i === idx ? { ...item, title: value } : item)));
                }}
              />
              <select
                value={q.type}
                onChange={(event) => {
                  const value = event.target.value as Question['type'];
                  setQuestions((prev) => prev.map((item, i) => (i === idx ? { ...item, type: value } : item)));
                }}
              >
                {QUESTION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          ))}
          <button type="submit">ذخیره فرم</button>
        </form>
      </div>

      <div className="card">
        <h3>{t('forms')}</h3>
        {!!organizationId && <small>شناسه سازمان: {organizationId}</small>}
        <ul>
          {(formsQuery.data ?? []).map((form: { id: string; title: string; publication?: { token: string } }) => (
            <li key={form.id} className="card">
              <strong>{form.title}</strong>
              <div className="row">
                <button onClick={() => publishMutation.mutate(form.id)}>{t('publish')}</button>
                <button className="secondary" onClick={() => setActiveFormId(form.id)}>
                  {t('responses')}
                </button>
              </div>
              {form.publication?.token && (
                <small dir="ltr">{`${window.location.origin.replace(':5173', ':5174')}/f/${form.publication.token}`}</small>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="card">
        <h3>{t('responses')}</h3>
        <div className="grid2">
          <select
            value={filterStatus}
            onChange={(event) => setFilterStatus(event.target.value)}
          >
            <option value="">همه وضعیت‌ها</option>
            <option value="partial">partial</option>
            <option value="completed">completed</option>
          </select>
          <input
            value={filterRespondentKey}
            onChange={(event) => setFilterRespondentKey(event.target.value)}
            placeholder="respondent key"
          />
          <input
            value={filterQuestionId}
            onChange={(event) => setFilterQuestionId(event.target.value)}
            placeholder="question id"
          />
          <input
            value={filterValueText}
            onChange={(event) => setFilterValueText(event.target.value)}
            placeholder="متن پاسخ"
          />
          <input
            value={filterDateFrom}
            onChange={(event) => setFilterDateFrom(event.target.value)}
            placeholder="dateFrom ISO"
          />
          <input
            value={filterDateTo}
            onChange={(event) => setFilterDateTo(event.target.value)}
            placeholder="dateTo ISO"
          />
        </div>
        <div className="row">
          <input
            value={savedFilterName}
            onChange={(event) => setSavedFilterName(event.target.value)}
            placeholder="نام فیلتر ذخیره‌شده"
          />
          <button onClick={() => saveFilterMutation.mutate()}>ذخیره فیلتر</button>
        </div>
        <div>
          {(savedFiltersQuery.data ?? []).map(
            (saved: {
              id: string;
              name: string;
              definition: Record<string, string>;
            }) => (
              <button
                key={saved.id}
                className="secondary"
                onClick={() => {
                  setFilterStatus(saved.definition.status ?? '');
                  setFilterRespondentKey(saved.definition.respondentKey ?? '');
                  setFilterQuestionId(saved.definition.questionId ?? '');
                  setFilterValueText(saved.definition.valueText ?? '');
                  setFilterDateFrom(saved.definition.dateFrom ?? '');
                  setFilterDateTo(saved.definition.dateTo ?? '');
                }}
              >
                {saved.name}
              </button>
            ),
          )}
        </div>
        <a href={exportUrl} target="_blank" rel="noreferrer">
          <button>{t('exportExcel')}</button>
        </a>
        <pre style={{ overflow: 'auto', background: '#f3f4f6', padding: 12 }}>
          {JSON.stringify(responsesQuery.data ?? [], null, 2)}
        </pre>
        <h4>{t('reports')}</h4>
        <pre style={{ overflow: 'auto', background: '#f3f4f6', padding: 12 }}>
          {JSON.stringify(summaryQuery.data ?? {}, null, 2)}
        </pre>
        <h4>کامنت تیم روی پاسخ</h4>
        <select
          value={selectedResponseId}
          onChange={(event) => setSelectedResponseId(event.target.value)}
        >
          <option value="">انتخاب پاسخ</option>
          {(responsesQuery.data ?? []).map((item: { id: string }) => (
            <option key={item.id} value={item.id}>
              {item.id}
            </option>
          ))}
        </select>
        {!!selectedResponseId && (
          <>
            <input
              value={commentAuthorName}
              onChange={(event) => setCommentAuthorName(event.target.value)}
              placeholder="نام نویسنده کامنت"
            />
            <textarea
              value={commentBody}
              onChange={(event) => setCommentBody(event.target.value)}
              placeholder="متن کامنت"
            />
            <button onClick={() => addCommentMutation.mutate()}>ثبت کامنت</button>
            <pre style={{ overflow: 'auto', background: '#f3f4f6', padding: 12 }}>
              {JSON.stringify(commentsQuery.data ?? [], null, 2)}
            </pre>
          </>
        )}
      </div>

      <div className="card">
        <h3>{t('aiTools')}</h3>
        <input value={aiGoal} onChange={(event) => setAiGoal(event.target.value)} />
        <button
          onClick={async () => {
            const result = await api.post('/ai/generate-form', { goal: aiGoal, language: 'fa' });
            setAiResult(result.data);
          }}
        >
          ساخت فرم با AI
        </button>
        <pre style={{ overflow: 'auto', background: '#f3f4f6', padding: 12 }}>
          {JSON.stringify(aiResult ?? {}, null, 2)}
        </pre>
      </div>
    </div>
  );
}

export default App;
