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
    | 'dropdown'
    | 'date'
    | 'static_text'
    | 'rating'
    | 'slider'
    | 'image_choice'
    | 'emoji'
    | 'nps'
    | 'ranking'
    | 'matrix'
    | 'file_upload'
    | 'camera'
    | 'audio_record'
    | 'signature'
    | 'location';
  options?: string[];
  required?: boolean;
  weight?: number;
  meta?: Record<string, unknown>;
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
  'date',
  'static_text',
  'rating',
  'slider',
  'image_choice',
  'emoji',
  'nps',
  'ranking',
  'matrix',
  'file_upload',
  'camera',
  'audio_record',
  'signature',
  'location',
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
  const [distributionType, setDistributionType] = useState('qr');
  const [selectedPublicationId, setSelectedPublicationId] = useState('');
  const [distributionAssets, setDistributionAssets] = useState<Record<string, unknown> | null>(null);
  const [apiKeyName, setApiKeyName] = useState('کلید داشبورد');
  const [newApiKey, setNewApiKey] = useState<Record<string, unknown> | null>(null);
  const [idpType, setIdpType] = useState('oauth');
  const [idpName, setIdpName] = useState('ورود سازمانی');
  const [chatQuestion, setChatQuestion] = useState('کدام شعبه کمترین رضایت را داشته؟');
  const [translateTarget, setTranslateTarget] = useState('en');
  const [invoiceAmount, setInvoiceAmount] = useState('1000000');
  const [licenseCaps, setLicenseCaps] = useState('{"offline":true,"maxUsers":500}');
  const [logicJson, setLogicJson] = useState('{\n  "display": [],\n  "skip": [],\n  "pipe": []\n}');
  const [scoreJson, setScoreJson] = useState('{\n  "indices": []\n}');
  const [logicAnalysis, setLogicAnalysis] = useState<Record<string, unknown> | null>(null);
  const [portalForms, setPortalForms] = useState<Record<string, unknown>[]>([]);
  const [webhookSecret, setWebhookSecret] = useState('test-secret');
  const [webhookPayload, setWebhookPayload] = useState('{"event":"response.completed"}');
  const [webhookSignature, setWebhookSignature] = useState('');
  const [webhookVerifyResult, setWebhookVerifyResult] = useState<Record<string, unknown> | null>(null);
  const [licenseKeyToValidate, setLicenseKeyToValidate] = useState('');
  const [licenseValidation, setLicenseValidation] = useState<Record<string, unknown> | null>(null);
  const [aiMetricsInput, setAiMetricsInput] = useState('{"satisfaction":72,"nps":41}');
  const [quizStructureJson, setQuizStructureJson] = useState(
    '{"pages":[{"questions":[{"id":"q1","meta":{"correctAnswer":"A","score":2}},{"id":"q2","meta":{"correctAnswer":5,"score":3}}]}]}',
  );
  const [quizAnswersJson, setQuizAnswersJson] = useState('{"q1":"A","q2":4}');
  const [eval360Json, setEval360Json] = useState(
    '{"evaluations":[{"role":"self","scores":{"leadership":4,"teamwork":5}},{"role":"manager","scores":{"leadership":3,"teamwork":4}},{"role":"peer","scores":{"leadership":4,"teamwork":4}}]}',
  );
  const [experienceMetricType, setExperienceMetricType] = useState<'nps' | 'csat' | 'ces' | 'enps'>('nps');
  const [experienceScoresJson, setExperienceScoresJson] = useState('[10,9,8,6,5]');
  const [templateCategory, setTemplateCategory] = useState<'mbti' | 'herzberg' | 'cx' | 'hr' | 'all'>('all');
  const [phase10Result, setPhase10Result] = useState<Record<string, unknown> | unknown[] | null>(null);

  const parseUnknownJson = (value: string) => {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  };

  const parseJsonSafe = (value: string, fallback: Record<string, unknown>) => {
    try {
      const parsed = JSON.parse(value) as Record<string, unknown>;
      return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch {
      return fallback;
    }
  };

  const refreshPortalForms = async () => {
    if (!organizationId) return;
    const res = await api.get(`/public/forms/portal/${organizationId}`);
    setPortalForms(res.data ?? []);
  };

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
    const isSafeId = /^[a-zA-Z0-9_-]+$/.test(activeFormId);
    if (!activeFormId || !isSafeId) return null;
    const base = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';
    return new URL(`/api/v1/responses/form/${activeFormId}/export`, base).toString();
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

  const distributionLogsQuery = useQuery({
    queryKey: ['distribution-logs', selectedPublicationId, token],
    queryFn: async () =>
      (
        await api.get('/distribution/delivery-logs', {
          params: { publicationId: selectedPublicationId },
        })
      ).data,
    enabled: Boolean(token && selectedPublicationId),
  });

  const apiKeysQuery = useQuery({
    queryKey: ['api-keys', organizationId, token],
    queryFn: async () =>
      (await api.get('/organization/api-keys', { params: { organizationId } })).data,
    enabled: Boolean(token && organizationId),
  });

  const identityProvidersQuery = useQuery({
    queryKey: ['idps', organizationId, token],
    queryFn: async () =>
      (
        await api.get('/organization/identity-providers', {
          params: { organizationId },
        })
      ).data,
    enabled: Boolean(token && organizationId),
  });

  const invoicesQuery = useQuery({
    queryKey: ['invoices', organizationId, token],
    queryFn: async () =>
      (await api.get('/billing/invoices', { params: { organizationId } })).data,
    enabled: Boolean(token && organizationId),
  });

  const licensesQuery = useQuery({
    queryKey: ['licenses', organizationId, token],
    queryFn: async () =>
      (await api.get('/billing/licenses', { params: { organizationId } })).data,
    enabled: Boolean(token && organizationId),
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

  const createChannelMutation = useMutation({
    mutationFn: (formId: string) =>
      api.post(`/distribution/forms/${formId}/publications/${distributionType}`),
    onSuccess: () => formsQuery.refetch(),
  });

  const loadAssetsMutation = useMutation({
    mutationFn: (publicationId: string) =>
      api.get(`/distribution/publications/${publicationId}/assets`),
    onSuccess: ({ data }) => setDistributionAssets(data),
  });

  const createApiKeyMutation = useMutation({
    mutationFn: () =>
      api.post('/organization/api-keys', {
        organizationId,
        name: apiKeyName,
      }),
    onSuccess: ({ data }) => {
      setNewApiKey(data);
      apiKeysQuery.refetch();
    },
  });

  const createIdentityProviderMutation = useMutation({
    mutationFn: () =>
      api.post('/organization/identity-providers', {
        organizationId,
        type: idpType,
        name: idpName,
        config: { endpoint: 'https://auth.company.local', clientId: 'samaline' },
      }),
    onSuccess: () => identityProvidersQuery.refetch(),
  });

  const createInvoiceMutation = useMutation({
    mutationFn: () =>
      api.post('/billing/invoices', {
        organizationId,
        amount: Number(invoiceAmount),
      }),
    onSuccess: () => invoicesQuery.refetch(),
  });

  const createLicenseMutation = useMutation({
    mutationFn: () => {
      let capabilities: Record<string, unknown> = {};
      try {
        capabilities = JSON.parse(licenseCaps) as Record<string, unknown>;
      } catch {
        capabilities = { raw: licenseCaps };
      }
      return (
      api.post('/billing/licenses', {
        organizationId,
        capabilities,
      })
      );
    },
    onSuccess: () => licensesQuery.refetch(),
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
      logic: parseJsonSafe(logicJson, { display: [], skip: [], pipe: [] }),
      scoreConfig: parseJsonSafe(scoreJson, { indices: [] }),
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
          <textarea
            value={logicJson}
            onChange={(event) => setLogicJson(event.target.value)}
            placeholder="JSON منطق (display/skip/pipe)"
            rows={8}
          />
          <textarea
            value={scoreJson}
            onChange={(event) => setScoreJson(event.target.value)}
            placeholder="JSON شاخص‌ها (scoreConfig.indices)"
            rows={6}
          />
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
          {(formsQuery.data ?? []).map(
            (form: {
              id: string;
              title: string;
              publication?: { id: string; token: string };
            }) => (
              <li key={form.id} className="card">
                <strong>{form.title}</strong>
                <div className="row">
                  <button onClick={() => publishMutation.mutate(form.id)}>
                    {t('publish')}
                  </button>
                  <button
                    className="secondary"
                    onClick={() => setActiveFormId(form.id)}
                  >
                    {t('responses')}
                  </button>
                </div>
                <div className="row">
                  <select
                    value={distributionType}
                    onChange={(event) => setDistributionType(event.target.value)}
                  >
                    <option value="qr">qr</option>
                    <option value="embed">embed</option>
                    <option value="popup">popup</option>
                    <option value="social">social</option>
                    <option value="sms">sms</option>
                    <option value="email">email</option>
                    <option value="kiosk">kiosk</option>
                    <option value="interviewer">interviewer</option>
                  </select>
                  <button onClick={() => createChannelMutation.mutate(form.id)}>
                    ساخت کانال انتشار
                  </button>
                </div>
                {form.publication?.token && (
                  <small dir="ltr">{`${window.location.origin.replace(':5173', ':5174')}/f/${form.publication.token}`}</small>
                )}
                {!!form.publication?.id && (
                  <button
                    className="secondary"
                    onClick={() => {
                      setSelectedPublicationId(form.publication!.id);
                      loadAssetsMutation.mutate(form.publication!.id);
                    }}
                  >
                    مشاهده دارایی انتشار
                  </button>
                )}
              </li>
            ),
          )}
        </ul>
      </div>

      <div className="card">
        <h3>انتشار پیشرفته (فاز ۴)</h3>
        <small>شناسه انتشار انتخابی: {selectedPublicationId || '-'}</small>
        <pre style={{ overflow: 'auto', background: '#f3f4f6', padding: 12 }}>
          {JSON.stringify(distributionAssets ?? {}, null, 2)}
        </pre>
        <h4>لاگ ارسال</h4>
        <pre style={{ overflow: 'auto', background: '#f3f4f6', padding: 12 }}>
          {JSON.stringify(distributionLogsQuery.data ?? [], null, 2)}
        </pre>
      </div>

      <div className="card">
        <h3>تحلیل منطق فرم (فاز ۵)</h3>
        <div className="row">
          <input
            value={activeFormId}
            onChange={(event) => setActiveFormId(event.target.value)}
            placeholder="formId"
          />
          <button
            onClick={async () => {
              if (!activeFormId) return;
              const result = await api.get(`/forms/${activeFormId}/logic-analysis`);
              setLogicAnalysis(result.data);
            }}
          >
            اجرای تحلیل
          </button>
        </div>
        <pre style={{ overflow: 'auto', background: '#f3f4f6', padding: 12 }}>
          {JSON.stringify(logicAnalysis ?? {}, null, 2)}
        </pre>
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
        <button
          onClick={() => {
            if (exportUrl) window.open(exportUrl, '_blank', 'noopener,noreferrer');
          }}
          disabled={!exportUrl}
        >
          {t('exportExcel')}
        </button>
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
        <input
          value={chatQuestion}
          onChange={(event) => setChatQuestion(event.target.value)}
          placeholder="سوال از داده‌ها"
        />
        <button
          onClick={async () => {
            const result = await api.post('/ai/chat-with-data', {
              question: chatQuestion,
              context: { formId: activeFormId || null },
            });
            setAiResult(result.data);
          }}
        >
          پرسش از داده
        </button>
        <div className="row">
          <select
            value={translateTarget}
            onChange={(event) => setTranslateTarget(event.target.value)}
          >
            <option value="fa">fa</option>
            <option value="en">en</option>
            <option value="ar">ar</option>
          </select>
          <button
            onClick={async () => {
              const result = await api.post('/ai/translate-form', {
                structure: { pages: [{ id: 'page_1', questions }] },
                targetLanguage: translateTarget,
              });
              setAiResult(result.data);
            }}
          >
            ترجمه فرم
          </button>
        </div>
        <pre style={{ overflow: 'auto', background: '#f3f4f6', padding: 12 }}>
          {JSON.stringify(aiResult ?? {}, null, 2)}
        </pre>
      </div>

      <div className="card">
        <h3>API و هویت سازمانی (فاز ۷)</h3>
        <div className="row">
          <input
            value={apiKeyName}
            onChange={(event) => setApiKeyName(event.target.value)}
            placeholder="نام API Key"
          />
          <button onClick={() => createApiKeyMutation.mutate()}>
            ایجاد API Key
          </button>
        </div>
        {!!newApiKey && (
          <pre style={{ overflow: 'auto', background: '#f3f4f6', padding: 12 }}>
            {JSON.stringify(newApiKey, null, 2)}
          </pre>
        )}
        <pre style={{ overflow: 'auto', background: '#f3f4f6', padding: 12 }}>
          {JSON.stringify(apiKeysQuery.data ?? [], null, 2)}
        </pre>
        <div className="row">
          <select value={idpType} onChange={(event) => setIdpType(event.target.value)}>
            <option value="oauth">oauth</option>
            <option value="ldap">ldap</option>
          </select>
          <input
            value={idpName}
            onChange={(event) => setIdpName(event.target.value)}
            placeholder="نام ارائه‌دهنده هویت"
          />
          <button onClick={() => createIdentityProviderMutation.mutate()}>
            ثبت ارائه‌دهنده هویت
          </button>
        </div>
        <pre style={{ overflow: 'auto', background: '#f3f4f6', padding: 12 }}>
          {JSON.stringify(identityProvidersQuery.data ?? [], null, 2)}
        </pre>
      </div>

      <div className="card">
        <h3>تکمیل فاز ۶ تا ۸</h3>
        <div className="row">
          <input
            value={aiMetricsInput}
            onChange={(event) => setAiMetricsInput(event.target.value)}
            placeholder='{"satisfaction":72}'
          />
          <button
            onClick={async () => {
              const metrics = parseUnknownJson(aiMetricsInput);
              const result = await api.post('/ai/summarize-metrics', {
                metrics:
                  metrics && typeof metrics === 'object'
                    ? (metrics as Record<string, number>)
                    : {},
              });
              setAiResult(result.data);
            }}
          >
            خلاصه شاخص‌ها با AI
          </button>
        </div>
        <div className="row">
          <button onClick={() => void refreshPortalForms()}>
            بارگیری پرتال نظرسنجی
          </button>
        </div>
        <pre style={{ overflow: 'auto', background: '#f3f4f6', padding: 12 }}>
          {JSON.stringify(portalForms ?? [], null, 2)}
        </pre>
        <div className="row">
          <input
            value={webhookSecret}
            onChange={(event) => setWebhookSecret(event.target.value)}
            placeholder="Webhook secret"
          />
          <input
            value={webhookPayload}
            onChange={(event) => setWebhookPayload(event.target.value)}
            placeholder="Webhook payload JSON"
          />
          <input
            value={webhookSignature}
            onChange={(event) => setWebhookSignature(event.target.value)}
            placeholder="Webhook signature"
          />
          <button
            onClick={async () => {
              const payload = parseUnknownJson(webhookPayload);
              const result = await api.post(
                '/integrations/webhooks/verify-signature',
                {
                  secret: webhookSecret,
                  signature: webhookSignature,
                  payload:
                    payload && typeof payload === 'object'
                      ? (payload as Record<string, unknown>)
                      : {},
                },
              );
              setWebhookVerifyResult(result.data);
            }}
          >
            بررسی امضای وبهوک
          </button>
        </div>
        <pre style={{ overflow: 'auto', background: '#f3f4f6', padding: 12 }}>
          {JSON.stringify(webhookVerifyResult ?? {}, null, 2)}
        </pre>
      </div>

      <div className="card">
        <h3>تجاری‌سازی و لایسنس (فاز ۹)</h3>
        <div className="row">
          <input
            value={invoiceAmount}
            onChange={(event) => setInvoiceAmount(event.target.value)}
            placeholder="مبلغ فاکتور"
          />
          <button onClick={() => createInvoiceMutation.mutate()}>
            ایجاد فاکتور
          </button>
        </div>
        <pre style={{ overflow: 'auto', background: '#f3f4f6', padding: 12 }}>
          {JSON.stringify(invoicesQuery.data ?? [], null, 2)}
        </pre>
        <div className="row">
          <input
            value={licenseCaps}
            onChange={(event) => setLicenseCaps(event.target.value)}
            placeholder='{"offline":true}'
          />
          <button onClick={() => createLicenseMutation.mutate()}>
            ایجاد لایسنس On-Prem
          </button>
        </div>
        <div className="row">
          <input
            value={licenseKeyToValidate}
            onChange={(event) => setLicenseKeyToValidate(event.target.value)}
            placeholder="License key"
          />
          <button
            onClick={async () => {
              if (!licenseKeyToValidate.trim()) return;
              const result = await api.post('/billing/licenses/validate', {
                licenseKey: licenseKeyToValidate.trim(),
              });
              setLicenseValidation(result.data);
            }}
          >
            اعتبارسنجی لایسنس
          </button>
        </div>
        <pre style={{ overflow: 'auto', background: '#f3f4f6', padding: 12 }}>
          {JSON.stringify(licenseValidation ?? {}, null, 2)}
        </pre>
        <pre style={{ overflow: 'auto', background: '#f3f4f6', padding: 12 }}>
          {JSON.stringify(licensesQuery.data ?? [], null, 2)}
        </pre>
      </div>

      <div className="card">
        <h3>ماژول‌های تخصصی (فاز ۱۰)</h3>

        <h4>آزمون‌ساز: تصحیح پاسخ</h4>
        <textarea
          value={quizStructureJson}
          onChange={(event) => setQuizStructureJson(event.target.value)}
          rows={4}
          placeholder="Quiz structure JSON"
        />
        <textarea
          value={quizAnswersJson}
          onChange={(event) => setQuizAnswersJson(event.target.value)}
          rows={3}
          placeholder="Quiz answers JSON"
        />
        <button
          onClick={async () => {
            const structure = parseUnknownJson(quizStructureJson);
            const answers = parseUnknownJson(quizAnswersJson);
            const result = await api.post('/specialized/quiz/grade', {
              structure:
                structure && typeof structure === 'object'
                  ? (structure as Record<string, unknown>)
                  : {},
              answers:
                answers && typeof answers === 'object'
                  ? (answers as Record<string, unknown>)
                  : {},
            });
            setPhase10Result(result.data);
          }}
        >
          محاسبه نمره آزمون
        </button>

        <h4>ارزیابی ۳۶۰: تجمیع نقش‌ها</h4>
        <textarea
          value={eval360Json}
          onChange={(event) => setEval360Json(event.target.value)}
          rows={4}
          placeholder="360 JSON"
        />
        <button
          onClick={async () => {
            const payload = parseUnknownJson(eval360Json);
            const result = await api.post('/specialized/evaluation-360/aggregate', {
              evaluations:
                payload &&
                typeof payload === 'object' &&
                Array.isArray((payload as { evaluations?: unknown[] }).evaluations)
                  ? (payload as { evaluations: unknown[] }).evaluations
                  : [],
            });
            setPhase10Result(result.data);
          }}
        >
          تجمیع ارزیابی ۳۶۰
        </button>

        <h4>NPS / CSAT / CES / eNPS</h4>
        <div className="row">
          <select
            value={experienceMetricType}
            onChange={(event) =>
              setExperienceMetricType(
                event.target.value as 'nps' | 'csat' | 'ces' | 'enps',
              )
            }
          >
            <option value="nps">nps</option>
            <option value="csat">csat</option>
            <option value="ces">ces</option>
            <option value="enps">enps</option>
          </select>
          <input
            value={experienceScoresJson}
            onChange={(event) => setExperienceScoresJson(event.target.value)}
            placeholder="[10,9,8,6,5]"
          />
          <button
            onClick={async () => {
              const scoresParsed = parseUnknownJson(experienceScoresJson);
              const scores = Array.isArray(scoresParsed)
                ? scoresParsed.map((item) => Number(item)).filter((n) => Number.isFinite(n))
                : [];
              const result = await api.post('/specialized/experience-metrics/calculate', {
                type: experienceMetricType,
                scores,
              });
              setPhase10Result(result.data);
            }}
          >
            محاسبه شاخص
          </button>
        </div>

        <h4>کتابخانه قالب‌ها</h4>
        <div className="row">
          <select
            value={templateCategory}
            onChange={(event) =>
              setTemplateCategory(
                event.target.value as 'mbti' | 'herzberg' | 'cx' | 'hr' | 'all',
              )
            }
          >
            <option value="all">all</option>
            <option value="mbti">mbti</option>
            <option value="herzberg">herzberg</option>
            <option value="cx">cx</option>
            <option value="hr">hr</option>
          </select>
          <button
            onClick={async () => {
              const result = await api.get('/specialized/templates', {
                params:
                  templateCategory === 'all'
                    ? {}
                    : { category: templateCategory },
              });
              setPhase10Result(result.data);
            }}
          >
            دریافت قالب‌ها
          </button>
        </div>

        <pre style={{ overflow: 'auto', background: '#f3f4f6', padding: 12 }}>
          {JSON.stringify(phase10Result ?? {}, null, 2)}
        </pre>
      </div>
    </div>
  );
}

export default App;
