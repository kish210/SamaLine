import { LogicRuntimeService } from './logic-runtime.service';
import type { FormStructure } from './logic-types';

describe('LogicRuntimeService', () => {
  const rt = new LogicRuntimeService();
  const ctx = (answers: Record<string, unknown>, extra = {}) => ({
    answers,
    ...extra,
  });

  describe('evaluateCondition — اپراتورها', () => {
    it('equals با تطبیق نوع نرم کار می‌کند', () => {
      expect(
        rt.evaluateCondition(
          { source: 'q1', operator: 'equals', value: 5 },
          ctx({ q1: '5' }),
        ),
      ).toBe(true);
    });

    it('not_equals مقدار متفاوت را می‌پذیرد', () => {
      expect(
        rt.evaluateCondition(
          { source: 'q1', operator: 'not_equals', value: 'الف' },
          ctx({ q1: 'ب' }),
        ),
      ).toBe(true);
    });

    it('contains روی متن و روی آرایه‌ی چندانتخابی کار می‌کند', () => {
      expect(
        rt.evaluateCondition(
          { source: 'q1', operator: 'contains', value: 'خوب' },
          ctx({ q1: 'خیلی خوب بود' }),
        ),
      ).toBe(true);
      expect(
        rt.evaluateCondition(
          { source: 'q1', operator: 'contains', value: 'c2' },
          ctx({ q1: ['c1', 'c2'] }),
        ),
      ).toBe(true);
    });

    it('starts_with ابتدای متن را می‌سنجد', () => {
      expect(
        rt.evaluateCondition(
          { source: 'q1', operator: 'starts_with', value: '۰۹' },
          ctx({ q1: '۰۹۱۲۳۴۵۶۷۸۹' }),
        ),
      ).toBe(true);
    });

    it('gt و lt عدد رشته‌ای را هم مقایسه می‌کنند', () => {
      expect(
        rt.evaluateCondition(
          { source: 'q1', operator: 'gt', value: 3 },
          ctx({ q1: '7' }),
        ),
      ).toBe(true);
      expect(
        rt.evaluateCondition(
          { source: 'q1', operator: 'lt', value: 3 },
          ctx({ q1: 7 }),
        ),
      ).toBe(false);
    });

    it('gt روی مقدار غیرعددی false می‌دهد نه خطا', () => {
      expect(
        rt.evaluateCondition(
          { source: 'q1', operator: 'gt', value: 3 },
          ctx({ q1: 'متن' }),
        ),
      ).toBe(false);
    });

    it('between هر دو کران را شامل می‌شود', () => {
      const c = {
        source: 'q1',
        operator: 'between' as const,
        value: 3,
        valueTo: 7,
      };
      expect(rt.evaluateCondition(c, ctx({ q1: 3 }))).toBe(true);
      expect(rt.evaluateCondition(c, ctx({ q1: 7 }))).toBe(true);
      expect(rt.evaluateCondition(c, ctx({ q1: 8 }))).toBe(false);
    });

    it('is_empty برای مقدار نبود، رشته‌ی خالی و آرایه‌ی خالی درست است', () => {
      const c = { source: 'q1', operator: 'is_empty' as const };
      expect(rt.evaluateCondition(c, ctx({}))).toBe(true);
      expect(rt.evaluateCondition(c, ctx({ q1: '   ' }))).toBe(true);
      expect(rt.evaluateCondition(c, ctx({ q1: [] }))).toBe(true);
      expect(rt.evaluateCondition(c, ctx({ q1: 'x' }))).toBe(false);
    });

    it('is_empty برای عدد صفر نادرست است', () => {
      expect(
        rt.evaluateCondition(
          { source: 'q1', operator: 'is_empty' },
          ctx({ q1: 0 }),
        ),
      ).toBe(false);
    });

    it('پارامتر مخفی و شاخص را به‌عنوان منبع می‌خواند', () => {
      expect(
        rt.evaluateCondition(
          { source: 'param.branch', operator: 'equals', value: 'تهران' },
          ctx({}, { params: { branch: 'تهران' } }),
        ),
      ).toBe(true);
      expect(
        rt.evaluateCondition(
          { source: 'score.satisfaction', operator: 'lt', value: 3 },
          ctx({}, { scores: { satisfaction: 2.5 } }),
        ),
      ).toBe(true);
    });
  });

  describe('evaluateGroup — ترکیب AND/OR تو در تو', () => {
    it('and همه‌ی شرط‌ها را لازم می‌داند', () => {
      const group = {
        combinator: 'and' as const,
        conditions: [
          { source: 'q1', operator: 'equals' as const, value: 'بله' },
          { source: 'q2', operator: 'gt' as const, value: 5 },
        ],
      };
      expect(rt.evaluateGroup(group, ctx({ q1: 'بله', q2: 6 }))).toBe(true);
      expect(rt.evaluateGroup(group, ctx({ q1: 'بله', q2: 4 }))).toBe(false);
    });

    it('or یک شرط را کافی می‌داند', () => {
      const group = {
        combinator: 'or' as const,
        conditions: [
          { source: 'q1', operator: 'equals' as const, value: 'بله' },
          { source: 'q2', operator: 'gt' as const, value: 5 },
        ],
      };
      expect(rt.evaluateGroup(group, ctx({ q1: 'خیر', q2: 9 }))).toBe(true);
      expect(rt.evaluateGroup(group, ctx({ q1: 'خیر', q2: 1 }))).toBe(false);
    });

    it('گروه تو در تو را درست ارزیابی می‌کند', () => {
      // q1=بله  AND  (q2>5  OR  q3 خالی نیست)
      const group = {
        combinator: 'and' as const,
        conditions: [
          { source: 'q1', operator: 'equals' as const, value: 'بله' },
          {
            combinator: 'or' as const,
            conditions: [
              { source: 'q2', operator: 'gt' as const, value: 5 },
              { source: 'q3', operator: 'is_not_empty' as const },
            ],
          },
        ],
      };
      expect(rt.evaluateGroup(group, ctx({ q1: 'بله', q2: 1, q3: 'x' }))).toBe(
        true,
      );
      expect(rt.evaluateGroup(group, ctx({ q1: 'بله', q2: 1 }))).toBe(false);
      expect(rt.evaluateGroup(group, ctx({ q1: 'خیر', q2: 9, q3: 'x' }))).toBe(
        false,
      );
    });

    it('گروه خالی خنثی است', () => {
      expect(
        rt.evaluateGroup({ combinator: 'and', conditions: [] }, ctx({})),
      ).toBe(true);
    });
  });

  describe('visibleQuestionIds — منطق نمایش', () => {
    const structure: FormStructure = {
      pages: [
        {
          id: 'p1',
          questions: [{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }],
        },
      ],
      logic: {
        display: [
          {
            targetQuestionId: 'q2',
            sourceQuestionId: 'q1',
            operator: 'equals',
            value: 'بله',
          },
        ],
      },
    };

    it('سوال بدون قانون همیشه دیده می‌شود', () => {
      const visible = rt.visibleQuestionIds(structure, ctx({}));
      expect(visible.has('q1')).toBe(true);
      expect(visible.has('q3')).toBe(true);
    });

    it('سوال شرطی تا برقرار نشدن شرط پنهان است', () => {
      expect(rt.visibleQuestionIds(structure, ctx({})).has('q2')).toBe(false);
      expect(
        rt.visibleQuestionIds(structure, ctx({ q1: 'بله' })).has('q2'),
      ).toBe(true);
    });

    it('قانون hide با برقراری شرط سوال را پنهان می‌کند', () => {
      const s: FormStructure = {
        pages: [{ id: 'p1', questions: [{ id: 'q1' }, { id: 'q2' }] }],
        logic: {
          display: [
            {
              targetQuestionId: 'q2',
              action: 'hide',
              sourceQuestionId: 'q1',
              operator: 'equals',
              value: 'خیر',
            },
          ],
        },
      };
      expect(rt.visibleQuestionIds(s, ctx({ q1: 'خیر' })).has('q2')).toBe(
        false,
      );
      expect(rt.visibleQuestionIds(s, ctx({ q1: 'بله' })).has('q2')).toBe(true);
    });

    it('شرط روی شاخص محاسبه‌شده کار می‌کند', () => {
      const s: FormStructure = {
        pages: [{ id: 'p1', questions: [{ id: 'why' }] }],
        logic: {
          display: [
            {
              targetQuestionId: 'why',
              when: {
                combinator: 'and',
                conditions: [
                  { source: 'score.satisfaction', operator: 'lt', value: 3 },
                ],
              },
            },
          ],
        },
      };
      expect(
        rt
          .visibleQuestionIds(s, ctx({}, { scores: { satisfaction: 2 } }))
          .has('why'),
      ).toBe(true);
      expect(
        rt
          .visibleQuestionIds(s, ctx({}, { scores: { satisfaction: 8 } }))
          .has('why'),
      ).toBe(false);
    });

    it('سوالات صفحه‌ی پنهان دیده نمی‌شوند', () => {
      const s: FormStructure = {
        pages: [
          { id: 'p1', questions: [{ id: 'q1' }] },
          { id: 'p2', questions: [{ id: 'q2' }] },
        ],
        logic: {
          display: [
            {
              targetPageId: 'p2',
              sourceQuestionId: 'q1',
              operator: 'equals',
              value: 'بله',
            },
          ],
        },
      };
      expect(rt.visibleQuestionIds(s, ctx({ q1: 'خیر' })).has('q2')).toBe(
        false,
      );
      expect(rt.visibleQuestionIds(s, ctx({ q1: 'بله' })).has('q2')).toBe(true);
    });
  });

  describe('nextStep — منطق پرش', () => {
    const threePages: FormStructure = {
      pages: [
        { id: 'p1', questions: [{ id: 'q1' }] },
        { id: 'p2', questions: [{ id: 'q2' }] },
        { id: 'p3', questions: [{ id: 'q3' }] },
      ],
    };

    it('بدون صفحه‌ی جاری، اولین صفحه را می‌دهد', () => {
      expect(rt.nextStep(threePages, null, ctx({}))).toEqual({
        nextPageId: 'p1',
        finished: false,
        reason: 'sequential',
      });
    });

    it('به‌صورت پیش‌فرض ترتیبی جلو می‌رود', () => {
      expect(rt.nextStep(threePages, 'p1', ctx({})).nextPageId).toBe('p2');
    });

    it('در انتهای فرم پایان را اعلام می‌کند', () => {
      expect(rt.nextStep(threePages, 'p3', ctx({}))).toEqual({
        nextPageId: null,
        finished: true,
        reason: 'end_of_form',
      });
    });

    it('قانون پرش با شرط برقرار، صفحه را جابه‌جا می‌کند', () => {
      const s: FormStructure = {
        ...threePages,
        logic: {
          skip: [
            {
              fromQuestionId: 'q1',
              toPageId: 'p3',
              when: {
                combinator: 'and',
                conditions: [
                  { source: 'q1', operator: 'equals', value: 'خیر' },
                ],
              },
            },
          ],
        },
      };
      expect(rt.nextStep(s, 'p1', ctx({ q1: 'خیر' }))).toEqual({
        nextPageId: 'p3',
        finished: false,
        reason: 'skip_rule',
      });
      expect(rt.nextStep(s, 'p1', ctx({ q1: 'بله' })).nextPageId).toBe('p2');
    });

    it('پرش به پایان فرم پشتیبانی می‌شود', () => {
      const s: FormStructure = {
        ...threePages,
        logic: { skip: [{ fromPageId: 'p1', toEnd: true }] },
      };
      expect(rt.nextStep(s, 'p1', ctx({}))).toEqual({
        nextPageId: null,
        finished: true,
        reason: 'skip_rule',
      });
    });

    it('صفحه‌ی پنهان در مسیر ترتیبی رد می‌شود', () => {
      const s: FormStructure = {
        ...threePages,
        logic: {
          display: [
            {
              targetPageId: 'p2',
              sourceQuestionId: 'q1',
              operator: 'equals',
              value: 'بله',
            },
          ],
        },
      };
      expect(rt.nextStep(s, 'p1', ctx({ q1: 'خیر' })).nextPageId).toBe('p3');
      expect(rt.nextStep(s, 'p1', ctx({ q1: 'بله' })).nextPageId).toBe('p2');
    });

    it('فرم بدون صفحه را پایان‌یافته می‌داند', () => {
      expect(rt.nextStep({}, null, ctx({}))).toEqual({
        nextPageId: null,
        finished: true,
        reason: 'end_of_form',
      });
    });
  });

  describe('stripHiddenAnswers', () => {
    const s: FormStructure = {
      pages: [{ id: 'p1', questions: [{ id: 'q1' }, { id: 'q2' }] }],
      logic: {
        display: [
          {
            targetQuestionId: 'q2',
            sourceQuestionId: 'q1',
            operator: 'equals',
            value: 'بله',
          },
        ],
      },
    };

    it('پاسخ سوال پنهان را حذف می‌کند', () => {
      expect(rt.stripHiddenAnswers(s, { q1: 'خیر', q2: 'جعلی' })).toEqual({
        q1: 'خیر',
      });
    });

    it('وقتی شرط برقرار است پاسخ را نگه می‌دارد', () => {
      expect(rt.stripHiddenAnswers(s, { q1: 'بله', q2: 'واقعی' })).toEqual({
        q1: 'بله',
        q2: 'واقعی',
      });
    });

    it('کلید ناشناخته (پارامتر مخفی) دست‌نخورده می‌ماند', () => {
      expect(
        rt.stripHiddenAnswers(s, { q1: 'خیر', utm_source: 'sms' }),
      ).toEqual({ q1: 'خیر', utm_source: 'sms' });
    });

    it('ساختار بدون سوال، پاسخ‌ها را دور نمی‌ریزد', () => {
      expect(rt.stripHiddenAnswers({}, { q1: 'x' })).toEqual({ q1: 'x' });
    });
  });
});
