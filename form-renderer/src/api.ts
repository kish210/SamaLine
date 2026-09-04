import axios from 'axios';
import type {
  Answers,
  NextStepResponse,
  PublicForm,
  ResolvePageResponse,
} from './types';

const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

const client = axios.create({ baseURL: apiBase });

/** اعتبار دسترسی پاسخ‌دهنده در هدر جدا می‌رود، نه Authorization. */
export function setRespondentToken(token?: string) {
  if (token) {
    client.defaults.headers.common['x-respondent-token'] = token;
  } else {
    delete client.defaults.headers.common['x-respondent-token'];
  }
}

export const dashboardApi = {
  getPublic: (publicToken: string) =>
    client
      .get<{
        name: string;
        widgets: Array<{
          id: string;
          type: 'stat' | 'bar' | 'nps' | 'text' | 'score';
          title: string;
          layout: { x: number; y: number; w: number; h: number };
          value?: number | string;
          series?: Array<{ label: string; count: number }>;
          content?: string;
          error?: string;
        }>;
      }>(`/public/dashboards/${publicToken}`)
      .then((r) => r.data),
};

export const formApi = {
  authInfo: (token: string) =>
    client
      .get<{ authMode: string; requiresAuth: boolean }>(
        `/public/forms/${token}/auth-info`,
      )
      .then((r) => r.data),

  loginWithPassword: (token: string, password: string) =>
    client
      .post<{ accessToken: string }>(`/public/forms/${token}/auth/password`, {
        password,
      })
      .then((r) => r.data),

  requestOtp: (token: string, destination: string) =>
    client
      .post<{ sent: boolean; channel: string; expiresInSeconds: number }>(
        `/public/forms/${token}/auth/otp/request`,
        { destination },
      )
      .then((r) => r.data),

  verifyOtp: (token: string, destination: string, code: string) =>
    client
      .post<{ accessToken: string; respondentKey: string | null }>(
        `/public/forms/${token}/auth/otp/verify`,
        { destination, code },
      )
      .then((r) => r.data),

  get: (token: string) =>
    client.get<PublicForm>(`/public/forms/${token}`).then((r) => r.data),

  /**
   * گام بعدی. منطق پرش و نمایش کاملا سمت سرور اجرا می‌شود تا یک
   * پیاده‌سازی واحد داشته باشیم و کلاینت نتواند آن را دور بزند.
   */
  nextStep: (
    token: string,
    body: {
      currentPageId?: string | null;
      answers?: Answers;
      params?: Record<string, unknown>;
    },
  ) =>
    client
      .post<NextStepResponse>(`/public/forms/${token}/next`, body)
      .then((r) => r.data),

  /** تازه‌سازی صفحه‌ی جاری وقتی پاسخی تغییر می‌کند و سوالی شرطی است. */
  resolvePage: (
    token: string,
    pageId: string,
    body: { answers?: Answers; params?: Record<string, unknown> },
  ) =>
    client
      .post<ResolvePageResponse>(`/public/forms/${token}/pages/${pageId}`, body)
      .then((r) => r.data),

  getProgress: (token: string, respondentKey: string) =>
    client
      .get<{ exists: boolean; answers: Answers }>(
        `/public/forms/${token}/progress/${encodeURIComponent(respondentKey)}`,
      )
      .then((r) => r.data),

  saveProgress: (
    token: string,
    body: { respondentKey: string; answers: Answers; meta?: unknown },
  ) => client.post(`/public/forms/${token}/save-progress`, body),

  submit: (
    token: string,
    body: { respondentKey?: string; answers: Answers; meta?: unknown },
  ) => client.post(`/public/forms/${token}/submit`, body),
};
