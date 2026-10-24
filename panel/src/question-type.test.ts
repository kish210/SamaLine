import { describe, it, expect } from 'vitest';
import { reconcileQuestionType, OPTION_TYPES } from './question-type';
import type { Question } from './types';

const q = (over: Partial<Question>): Pick<Question, 'type' | 'options' | 'meta'> => ({
  type: 'short_text',
  ...over,
});

describe('reconcileQuestionType — رفع باگ تغییر نوع سوال', () => {
  it('نوعِ بدون تغییر، patch خالی و بدون دورریز می‌دهد', () => {
    const r = reconcileQuestionType(q({ type: 'rating', meta: { min: 1, max: 5 } }), 'rating');
    expect(r.patch).toEqual({});
    expect(r.dropped).toEqual([]);
  });

  it('سوئیچ از چندگزینه‌ای به عدد، گزینه‌ها و multiple را دور می‌ریزد', () => {
    // همان باگِ گزارش‌شده: تنظیمات ناسازگار نباید روی سوال بماند.
    const r = reconcileQuestionType(
      q({ type: 'multiple_choice', options: ['الف', 'ب'], meta: { multiple: true } }),
      'number',
    );
    expect(r.patch.type).toBe('number');
    expect(r.patch.options).toBeUndefined();
    expect(r.patch.meta).not.toHaveProperty('multiple');
    expect(r.dropped.length).toBeGreaterThan(0);
  });

  it('کلیدهای مستقل از نوع (hidden/imageUrl) همیشه می‌مانند', () => {
    const r = reconcileQuestionType(
      q({ type: 'multiple_choice', options: ['x'], meta: { hidden: true, imageUrl: 'u', multiple: true } }),
      'short_text',
    );
    expect(r.patch.meta).toMatchObject({ hidden: true, imageUrl: 'u' });
    expect(r.patch.meta).not.toHaveProperty('multiple');
  });

  it('گزینه‌ها میان نوع‌های گزینه‌دار حفظ می‌شوند، بدون دورریز', () => {
    const r = reconcileQuestionType(
      q({ type: 'multiple_choice', options: ['الف', 'ب'] }),
      'dropdown',
    );
    expect(r.patch.options).toEqual(['الف', 'ب']);
    expect(r.dropped).toEqual([]);
  });

  it('سوئیچ به rating پیش‌فرض بازه را پر می‌کند', () => {
    const r = reconcileQuestionType(q({ type: 'short_text' }), 'rating');
    expect(r.patch.meta).toMatchObject({ min: 1, max: 5 });
  });

  it('سوئیچ به slider پیش‌فرض‌های min/max/step را پر می‌کند', () => {
    const r = reconcileQuestionType(q({ type: 'short_text' }), 'slider');
    expect(r.patch.meta).toMatchObject({ min: 0, max: 100, step: 1 });
  });

  it('سوئیچ به matrix ردیف/ستون پیش‌فرض می‌سازد و options را دور می‌ریزد اگر بوده', () => {
    const r = reconcileQuestionType(
      q({ type: 'multiple_choice', options: ['x', 'y'] }),
      'matrix',
    );
    expect(Array.isArray((r.patch.meta as any).rows)).toBe(true);
    expect(Array.isArray((r.patch.meta as any).columns)).toBe(true);
    expect(r.patch.options).toBeUndefined();
  });

  it('مقدارهای meta سازگار میان rating و slider (min/max) حفظ می‌شوند', () => {
    const r = reconcileQuestionType(
      q({ type: 'rating', meta: { min: 2, max: 8, style: 'star' } }),
      'slider',
    );
    // min/max مشترک‌اند و می‌مانند؛ style مخصوص rating است و باید برود.
    expect(r.patch.meta).toMatchObject({ min: 2, max: 8 });
    expect(r.patch.meta).not.toHaveProperty('style');
  });

  it('nps بازه نمی‌گیرد ولی labels را نگه می‌دارد', () => {
    const r = reconcileQuestionType(
      q({ type: 'rating', meta: { min: 1, max: 5, labels: { start: 'کم', end: 'زیاد' } } }),
      'nps',
    );
    expect(r.patch.meta).toMatchObject({ labels: { start: 'کم', end: 'زیاد' } });
    expect(r.patch.meta).not.toHaveProperty('min');
    expect(r.patch.meta).not.toHaveProperty('max');
  });

  it('ranking جزو نوع‌های گزینه‌دار است', () => {
    expect(OPTION_TYPES.has('ranking')).toBe(true);
  });
});
