export interface QuestionMeta {
  translations?: Record<string, string>;
  multiple?: boolean;
  min?: number;
  max?: number;
  step?: number;
  rows?: string[];
  columns?: string[];
  labels?: { start?: string; end?: string };
}

export interface Question {
  id: string;
  title: string;
  type: string;
  description?: string;
  required?: boolean;
  options?: string[];
  meta?: QuestionMeta;
}

export interface Page {
  id: string;
  title: string;
  questions: Question[];
}

export interface FormSettings {
  languages?: string[];
  startPageEnabled?: boolean;
  endPageEnabled?: boolean;
  startPageText?: string;
  endPageText?: string;
  saveProgress?: boolean;
}

export interface PublicForm {
  publicationId: string;
  formTitle: string;
  settings: FormSettings;
}

/** پاسخ اندپوینت گام بعدی؛ منطق پرش سمت سرور اعمال شده است. */
export interface NextStepResponse {
  nextPageId: string | null;
  finished: boolean;
  reason: 'skip_rule' | 'sequential' | 'end_of_form';
  page: Page | null;
  scores: Record<string, number>;
}

export interface ResolvePageResponse {
  page: Page;
  scores: Record<string, number>;
  isFirstPage: boolean;
}

export type Answers = Record<string, unknown>;
