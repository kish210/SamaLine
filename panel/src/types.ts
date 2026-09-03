export const QUESTION_TYPES = [
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
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

/** برچسب فارسی هر نوع سوال برای نمایش در فرم‌ساز. */
export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  short_text: 'متن کوتاه',
  long_text: 'متن بلند',
  email: 'ایمیل',
  url: 'وب‌سایت',
  phone: 'تلفن ثابت',
  mobile: 'موبایل',
  number: 'عدد',
  boolean: 'دو گزینه‌ای',
  multiple_choice: 'چندگزینه‌ای',
  dropdown: 'لیست بازشو',
  date: 'تاریخ',
  static_text: 'متن ثابت',
  rating: 'امتیازی',
  slider: 'نوار شناور',
  image_choice: 'انتخابی عکس‌دار',
  emoji: 'ایموجی',
  nps: 'NPS',
  ranking: 'اولویت‌بندی',
  matrix: 'ماتریس',
  file_upload: 'آپلود فایل',
  camera: 'دوربین',
  audio_record: 'ضبط صوتی',
  signature: 'امضا',
  location: 'موقعیت مکانی',
};

export interface Question {
  id: string;
  title: string;
  type: QuestionType;
  description?: string;
  options?: string[];
  required?: boolean;
  weight?: number;
  scoring?: { indexId?: string; weight?: number };
  meta?: Record<string, unknown>;
}

export interface FormPage {
  id: string;
  title: string;
  questions: Question[];
}

export interface FormSummary {
  id: string;
  workspaceId: string;
  title: string;
  slug: string;
  status: 'draft' | 'active' | 'closed' | 'archived';
  createdAt: string;
}

export interface Publication {
  id: string;
  formId: string;
  type: string;
  token: string;
  tags: string[];
  isActive: boolean;
}

export interface FormDetail extends FormSummary {
  settings: Record<string, unknown>;
  latestVersion?: {
    id: string;
    version: number;
    structure: {
      pages?: FormPage[];
      logic?: Record<string, unknown>;
      scoreIndexes?: Array<{ id: string; key: string; method?: string }>;
    };
  };
  publication?: Publication | null;
}

export interface AuthUser {
  id: string;
  fullName: string;
  email: string;
  organizationId?: string;
  workspaceId?: string;
}

export interface AuthPayload {
  accessToken: string;
  user: AuthUser;
}

export interface Workspace {
  id: string;
  organizationId: string;
  name: string;
}

export interface ResponseRow {
  id: string;
  respondentKey: string | null;
  status: string;
  submittedAt: string | null;
  durationSeconds: number | null;
  answers: Record<string, unknown>;
  scores: Record<string, number>;
}

export interface FlowGraph {
  nodes: Array<{ id: string; title: string; questionCount: number }>;
  edges: Array<{
    from: string;
    to: string | null;
    kind: 'sequential' | 'skip';
    conditional: boolean;
  }>;
  conditionalQuestions: string[];
}

export interface ContactList {
  id: string;
  name: string;
  tags: string[];
  createdAt: string;
}
