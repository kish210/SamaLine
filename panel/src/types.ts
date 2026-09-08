/** یک شاخص امتیازدهی فرم. */
export interface ScoreIndex {
  id: string;
  /** نامی که در گزارش و پایان فرم دیده می‌شود و کلید خروجی امتیاز است. */
  key: string;
  title?: string;
  method: 'sum' | 'avg' | 'weighted' | 'percent';
  maxScore?: number;
  /** سوال‌های عضو؛ عضویت از سمت شاخص اعلام می‌شود. */
  questionIds?: string[];
}

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
  /** نشانی اختصاصی و ثابت فرم؛ null یعنی تعیین نشده. */
  slug: string | null;
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
      scoreIndexes?: ScoreIndex[];
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

export interface FlowEdge {
  from: string;
  to: string | null;
  /** «otherwise» شاخه‌ی پیش‌فرضِ صفحه‌ای است که پرش شرطی دارد. */
  kind: 'sequential' | 'skip' | 'otherwise';
  conditional: boolean;
  /** جای قانون در logic.skip؛ برای ویرایش و حذف از بوم. */
  ruleIndex?: number;
  /** شرط به زبان آدمیزاد. */
  label?: string;
}

export interface FlowGraph {
  nodes: Array<{ id: string; title: string; questionCount: number }>;
  edges: FlowEdge[];
  conditionalQuestions: string[];
}

/** یک قانون پرش، همان شکلی که در logic.skip ذخیره می‌شود. */
export interface SkipRule {
  fromPageId?: string;
  fromQuestionId?: string;
  toPageId?: string;
  toQuestionId?: string;
  toEnd?: boolean;
  when?: {
    combinator: 'and' | 'or';
    conditions: Array<{
      source: string;
      operator: string;
      value?: unknown;
      valueTo?: unknown;
    }>;
  };
}

export interface ContactList {
  id: string;
  name: string;
  tags: string[];
  createdAt: string;
}

/** یک ستون نمودار در گزارش. */
export interface AnalyticsBar {
  label: string;
  count: number;
  percent: number;
}

export interface AnalyticsQuestion {
  id: string;
  title: string;
  type: string;
  answered: number;
  skipped: number;
  /** نحوه‌ی نمایش پیشنهادی سرور برای این سوال. */
  chart: 'bar' | 'scale' | 'nps' | 'text';
  bars: AnalyticsBar[];
  average: number | null;
  scale: { min: number; max: number } | null;
  nps: {
    promoters: number;
    passives: number;
    detractors: number;
    score: number;
  } | null;
  samples: string[];
  /** پرتکرارترین کلیدواژه‌های پاسخ‌های متنی. */
  keywords: Array<{ word: string; count: number }>;
}

export interface FormAnalytics {
  /** بازه‌ی اعمال‌شده؛ برای سربرگ گزارش چاپی. */
  range: {
    from: string | null;
    to: string | null;
    fromJalali: string | null;
    toJalali: string | null;
  };
  questions: AnalyticsQuestion[];
  /** روند روزانه؛ `jalali` برچسب آماده‌ی محور است. */
  trend: Array<{
    date: string;
    jalali: string;
    started: number;
    completed: number;
  }>;
  scores: Array<{
    key: string;
    average: number;
    count: number;
    maxScore: number | null;
    /** «نرخ شاخص»: میانگین به‌صورت درصدی از سقف. */
    rate: number | null;
  }>;
  totalResponses: number;
}

/** پرتال: چند فرم روی یک نشانی عمومی. */
export interface Portal {
  id: string;
  slug: string;
  title: string;
  description: string;
  logoUrl: string;
  /** ترتیب همین آرایه، ترتیب نمایش کارت‌هاست. */
  formIds: string[];
  isActive: boolean;
}
