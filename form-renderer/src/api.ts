import axios from 'axios';
import type {
  Answers,
  NextStepResponse,
  PublicForm,
  ResolvePageResponse,
} from './types';

const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

const client = axios.create({ baseURL: apiBase });

export const formApi = {
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
