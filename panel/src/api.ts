import axios from 'axios';
import type {
  AuthPayload,
  ContactList,
  FlowGraph,
  FormDetail,
  FormPage,
  FormSummary,
  Publication,
  ResponseRow,
  Workspace,
} from './types';

/** ورودی ساخت یا پیش‌نمایش اتصال به API بیرونی. */
export interface ContactSourceInput {
  listId: string;
  name: string;
  url: string;
  method?: string;
  headers?: Record<string, string>;
  itemsPath?: string;
  mapping: Record<string, string>;
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1',
});

export function setAuthToken(token?: string) {
  if (token) {
    api.defaults.headers.common.Authorization = 'Bearer ' + token;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

/** پیام خطای خواناى فارسی از پاسخ سرور. */
export function describeError(error: unknown): string {
  const message = (
    error as { response?: { data?: { message?: string | string[] } } }
  )?.response?.data?.message;
  if (Array.isArray(message)) return message.join(' | ');
  return message ?? 'خطا در ارتباط با سرور';
}

export const authApi = {
  register: (body: {
    fullName: string;
    email: string;
    password: string;
    organizationName: string;
    workspaceName: string;
  }) => api.post<AuthPayload>('/auth/register', body).then((r) => r.data),

  login: (body: { email: string; password: string }) =>
    api.post<AuthPayload>('/auth/login', body).then((r) => r.data),
};

export const workspaceApi = {
  list: () => api.get<Workspace[]>('/workspaces').then((r) => r.data),
  create: (name: string) =>
    api.post<Workspace>('/workspaces', { name }).then((r) => r.data),
};

export const formsApi = {
  list: (workspaceId: string) =>
    api
      .get<FormSummary[]>('/forms', { params: { workspaceId } })
      .then((r) => r.data),

  get: (id: string) => api.get<FormDetail>(`/forms/${id}`).then((r) => r.data),

  create: (body: {
    workspaceId: string;
    title: string;
    slug: string;
    pages: FormPage[];
    settings?: Record<string, unknown>;
    logic?: Record<string, unknown>;
    scoreConfig?: Record<string, unknown>;
  }) => api.post<FormDetail>('/forms', body).then((r) => r.data),

  update: (id: string, body: Record<string, unknown>) =>
    api.patch<FormDetail>(`/forms/${id}`, body).then((r) => r.data),

  publishLink: (id: string) =>
    api.post<Publication>(`/forms/${id}/publish-link`).then((r) => r.data),

  logicAnalysis: (id: string) =>
    api
      .get<{ errors: string[]; warnings: string[]; isValid: boolean }>(
        `/forms/${id}/logic-analysis`,
      )
      .then((r) => r.data),

  flowGraph: (id: string) =>
    api.get<FlowGraph>(`/forms/${id}/flow-graph`).then((r) => r.data),

  setSlug: (id: string, slug: string) =>
    api.patch<Publication>(`/forms/${id}/slug`, { slug }).then((r) => r.data),

  slugAvailability: (slug: string) =>
    api
      .get<{ available: boolean; reason: string | null }>(
        `/forms/slug-availability/${encodeURIComponent(slug)}`,
      )
      .then((r) => r.data),
};

export const reportsApi = {
  summary: (formId: string) =>
    api
      .get<{
        visits: number;
        started: number;
        completed: number;
        completionRate: number;
      }>(`/reports/forms/${formId}/summary`)
      .then((r) => r.data),

  responses: (formId: string, params?: Record<string, unknown>) =>
    api
      .get<ResponseRow[]>(`/reports/forms/${formId}/responses`, { params })
      .then((r) => r.data),

  /**
   * دانلود خروجی. چون اندپوینت با هدر Authorization محافظت می‌شود،
   * فایل را به‌صورت blob می‌گیریم و در مرورگر ذخیره می‌کنیم.
   */
  download: async (
    formId: string,
    format: 'xlsx' | 'csv',
    advanced: boolean,
  ) => {
    const response = await api.get<Blob>(
      `/reports/forms/${formId}/export.${format}`,
      { params: { advanced }, responseType: 'blob' },
    );

    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = `responses-${formId}.${format}`;
    link.click();
    URL.revokeObjectURL(url);
  },

  breakdown: (questionId: string, formId: string) =>
    api
      .get<Array<{ label: string; count: number }>>(
        `/reports/questions/${questionId}/breakdown`,
        { params: { formId } },
      )
      .then((r) => r.data),
};

export const contactsApi = {
  lists: () => api.get<ContactList[]>('/contacts/lists').then((r) => r.data),

  createList: (name: string) =>
    api.post<ContactList>('/contacts/lists', { name }).then((r) => r.data),

  importCsv: (listId: string, csv: string) =>
    api
      .post<{ created: number; updated: number; skipped: string[] }>(
        `/contacts/lists/${listId}/import`,
        { csv },
      )
      .then((r) => r.data),

  contacts: (listId: string) =>
    api
      .get<
        Array<{
          id: string;
          fullName: string | null;
          mobile: string | null;
          email: string | null;
          unsubscribed: boolean;
        }>
      >(`/contacts/lists/${listId}/contacts`)
      .then((r) => r.data),

  // ── اتصال به API نرم‌افزارهای دیگر ──
  sources: () =>
    api
      .get<
        Array<{
          id: string;
          name: string;
          url: string;
          listId: string;
          itemsPath: string;
          headerKeys: string[];
          lastSyncedAt: string | null;
          lastResult: Record<string, unknown>;
        }>
      >('/contacts/sources')
      .then((r) => r.data),

  previewSource: (body: ContactSourceInput) =>
    api
      .post<{
        totalFetched: number;
        usable: number;
        unusable: number;
        sampleRaw: Array<Record<string, unknown>>;
        sampleMapped: Array<Record<string, unknown>>;
      }>('/contacts/sources/preview', body)
      .then((r) => r.data),

  createSource: (body: ContactSourceInput) =>
    api.post('/contacts/sources', body).then((r) => r.data),

  syncSource: (sourceId: string) =>
    api
      .post<{
        fetched: number;
        created: number;
        updated: number;
        unusable: number;
      }>(`/contacts/sources/${sourceId}/sync`)
      .then((r) => r.data),

  removeSource: (sourceId: string) =>
    api.delete(`/contacts/sources/${sourceId}`).then((r) => r.data),

  recipients: (listId: string, channel: 'sms' | 'email') =>
    api
      .get<Array<{ to: string; variables: Record<string, unknown> }>>(
        `/contacts/lists/${listId}/recipients`,
        { params: { channel } },
      )
      .then((r) => r.data),
};

export const messagingApi = {
  status: () =>
    api
      .get<{
        providers: { sms: string; email: string };
        queue: { pending: number; active: number };
      }>('/messaging/status')
      .then((r) => r.data),

  sendCampaign: (body: {
    publicationId: string;
    channel: 'sms' | 'email';
    recipients: Array<{ to: string; variables?: Record<string, unknown> }>;
    template: string;
    subject?: string;
  }) =>
    api
      .post<{ total: number; sent: number; failed: number }>(
        '/messaging/campaigns',
        body,
      )
      .then((r) => r.data),

  pending: (publicationId: string) =>
    api
      .get<Array<{ recipient: string; respondentKey: string }>>(
        `/messaging/campaigns/${publicationId}/pending`,
      )
      .then((r) => r.data),
};

export const aiApi = {
  createSurvey: (goal: string) =>
    api
      .post<Record<string, unknown>>('/ai/generate-form', { goal })
      .then((r) => r.data),

  review: (structure: Record<string, unknown>) =>
    api
      .post<Record<string, unknown>>('/ai/review-form', { structure })
      .then((r) => r.data),

  analyze: (answers: string[]) =>
    api
      .post<Record<string, unknown>>('/ai/analyze-open-text', { answers })
      .then((r) => r.data),
};

export const plansApi = {
  policy: (organizationId: string) =>
    api
      .get<Record<string, unknown>>(`/plans/policy/${organizationId}`)
      .then((r) => r.data),
};
