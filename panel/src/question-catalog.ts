import { QUESTION_TYPE_LABELS } from './types';
import type { QuestionType } from './types';

/**
 * دسته‌بندی انواع سوال برای فهرست «افزودن سوال».
 *
 * با ۲۴ نوع سوال، یک فهرست تخت عملاً غیرقابل مرور است؛ دسته‌بندی همان
 * کاری است که فرم‌سازهای رقیب هم می‌کنند.
 */
export interface QuestionCategory {
  key: string;
  label: string;
  types: QuestionType[];
}

export const QUESTION_CATEGORIES: QuestionCategory[] = [
  {
    key: 'text',
    label: 'متنی',
    types: ['short_text', 'long_text', 'static_text'],
  },
  {
    key: 'choice',
    label: 'انتخابی',
    types: ['multiple_choice', 'dropdown', 'boolean', 'image_choice', 'emoji'],
  },
  {
    key: 'scale',
    label: 'سنجش و امتیاز',
    types: ['nps', 'rating', 'slider', 'matrix', 'ranking'],
  },
  {
    key: 'contact',
    label: 'اطلاعات تماس',
    types: ['email', 'mobile', 'phone', 'url'],
  },
  {
    key: 'data',
    label: 'داده',
    types: ['number', 'date', 'location'],
  },
  {
    key: 'media',
    label: 'رسانه و فایل',
    types: ['file_upload', 'camera', 'audio_record', 'signature'],
  },
];

/** آیکن هر نوع سوال؛ برای فهرست تصویری افزودن سوال. */
export const QUESTION_TYPE_ICONS: Record<QuestionType, string> = {
  short_text: '▬',
  long_text: '☰',
  static_text: '¶',
  email: '@',
  url: '🔗',
  phone: '☎',
  mobile: '📱',
  number: '#',
  boolean: '◑',
  multiple_choice: '◉',
  dropdown: '▾',
  date: '📅',
  rating: '★',
  slider: '⇿',
  image_choice: '🖼',
  emoji: '☺',
  nps: '📊',
  ranking: '⇅',
  matrix: '▦',
  file_upload: '📎',
  camera: '📷',
  audio_record: '🎙',
  signature: '✍',
  location: '📍',
};

/** برچسب فارسی یک نوع سوال. */
export function typeLabel(type: QuestionType): string {
  return QUESTION_TYPE_LABELS[type];
}
