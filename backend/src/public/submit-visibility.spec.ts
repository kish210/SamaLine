import { LogicRuntimeService } from '../forms/logic-runtime.service';
import { ScoreEngineService } from '../forms/score-engine.service';
import type { FormStructure } from '../forms/logic-types';

/**
 * سناریوی واقعی ثبت پاسخ: سوال «why» فقط وقتی نمایش داده می‌شود
 * که شاخص رضایت زیر ۵ باشد. پاسخِ ارسالی به سوال پنهان نباید ذخیره شود.
 */
describe('پاک‌سازی پاسخ سوال پنهان هنگام ثبت', () => {
  const runtime = new LogicRuntimeService();
  const scoreEngine = new ScoreEngineService();

  const structure: FormStructure = {
    pages: [
      {
        id: 'p1',
        questions: [{ id: 'q1' }, { id: 'rate', scoring: { indexId: 'i1' } }],
      },
      { id: 'p2', questions: [{ id: 'why' }, { id: 'note' }] },
    ],
    logic: {
      display: [
        {
          targetQuestionId: 'why',
          when: {
            combinator: 'and',
            conditions: [
              { source: 'score.satisfaction', operator: 'lt', value: 5 },
            ],
          },
        },
      ],
    },
    scoreIndexes: [{ id: 'i1', key: 'satisfaction', method: 'avg' }],
  };

  const submit = (answers: Record<string, unknown>) => {
    const preliminary = scoreEngine.calculate(structure, answers);
    return runtime.stripHiddenAnswers(structure, answers, {}, preliminary);
  };

  it('با امتیاز بالا، پاسخ جعلی به سوال پنهان حذف می‌شود', () => {
    expect(
      submit({ q1: 'بله', rate: 9, why: 'جعلی', note: 'یادداشت' }),
    ).toEqual({ q1: 'بله', rate: 9, note: 'یادداشت' });
  });

  it('با امتیاز پایین، پاسخ سوال نمایش‌داده‌شده حفظ می‌شود', () => {
    expect(
      submit({ q1: 'بله', rate: 2, why: 'گران بود', note: 'یادداشت' }),
    ).toEqual({ q1: 'بله', rate: 2, why: 'گران بود', note: 'یادداشت' });
  });
});
