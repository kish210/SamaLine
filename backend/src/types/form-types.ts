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

export const ADVANCED_QUESTION_TYPES = [
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

export const ALL_QUESTION_TYPES = [
  ...PHASE1_QUESTION_TYPES,
  ...ADVANCED_QUESTION_TYPES,
] as const;
