export const PHASE1_QUESTION_TYPES = [
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
] as const;

export type Phase1QuestionType = (typeof PHASE1_QUESTION_TYPES)[number];
