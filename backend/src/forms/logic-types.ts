/** اپراتورهای شرط، مطابق بخش ۵ سند محصول. */
export const LOGIC_OPERATORS = [
  'equals',
  'not_equals',
  'contains',
  'starts_with',
  'gt',
  'lt',
  'between',
  'is_empty',
  'is_not_empty',
] as const;

export type LogicOperator = (typeof LOGIC_OPERATORS)[number];

/**
 * یک شرط تکی.
 * `source` می‌تواند شناسه‌ی سوال، `param.<name>` (پارامتر مخفی)
 * یا `score.<key>` (مقدار شاخص محاسبه‌شده) باشد.
 */
export interface LogicCondition {
  source: string;
  operator: LogicOperator;
  value?: unknown;
  /** کران بالای اپراتور between. */
  valueTo?: unknown;
}

/** گروه شرط با ترکیب AND/OR؛ گروه‌ها می‌توانند تو در تو باشند. */
export interface LogicConditionGroup {
  combinator: 'and' | 'or';
  conditions: Array<LogicCondition | LogicConditionGroup>;
}

export function isConditionGroup(
  node: LogicCondition | LogicConditionGroup,
): node is LogicConditionGroup {
  return 'combinator' in node;
}

/**
 * قانون نمایش. دو شکل پشتیبانی می‌شود:
 * - شکل ساده (سازگاری با داده‌ی موجود): sourceQuestionId + operator + value
 * - شکل کامل: when (گروه شرط تو در تو)
 */
export interface DisplayRule {
  targetQuestionId?: string;
  targetPageId?: string;
  /** پیش‌فرض show: با برقراری شرط نمایش داده می‌شود. */
  action?: 'show' | 'hide';
  sourceQuestionId?: string;
  operator?: LogicOperator;
  value?: unknown;
  valueTo?: unknown;
  when?: LogicConditionGroup;
}

/** قانون پرش: پس از سوال/صفحه‌ی مبدا، به مقصد برو. */
export interface SkipRule {
  fromQuestionId?: string;
  fromPageId?: string;
  toPageId?: string;
  toQuestionId?: string;
  /** پایان دادن به فرم به‌جای رفتن به صفحه‌ی بعد. */
  toEnd?: boolean;
  when?: LogicConditionGroup;
}

/** گزینه‌ی یک سوال، با وزن برای امتیازدهی (بند ۶ سند). */
export interface FormChoiceNode {
  id: string;
  label?: string;
  weight?: number;
  hidden?: boolean;
}

/** شاخص امتیازدهی فرم. */
export interface ScoreIndexNode {
  id: string;
  key: string;
  title?: string;
  method?: 'sum' | 'avg' | 'weighted' | 'percent';
  maxScore?: number;
}

export interface FormQuestionNode {
  id: string;
  type?: string;
  title?: string;
  description?: string;
  required?: boolean;
  weight?: number;
  scoring?: { indexId?: string; weight?: number };
  choices?: FormChoiceNode[];
  [key: string]: unknown;
}

export interface FormPageNode {
  id: string;
  title?: string;
  questions?: FormQuestionNode[];
  [key: string]: unknown;
}

export interface FormLogic {
  display?: DisplayRule[];
  skip?: SkipRule[];
  pipe?: Array<{ source: string; targetQuestionId: string }>;
}

export interface FormStructure {
  pages?: FormPageNode[];
  logic?: FormLogic;
  scoreIndexes?: ScoreIndexNode[];
  [key: string]: unknown;
}

/** زمینه‌ای که شرط‌ها بر اساس آن ارزیابی می‌شوند. */
export interface LogicContext {
  answers: Record<string, unknown>;
  params?: Record<string, unknown>;
  scores?: Record<string, number>;
}
