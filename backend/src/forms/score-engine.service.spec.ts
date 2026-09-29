import { ScoreEngineService } from './score-engine.service';

describe('ScoreEngineService', () => {
  const engine = new ScoreEngineService();

  const structure = (
    method: 'sum' | 'avg' | 'weighted' | 'percent',
    extras: Record<string, unknown> = {},
  ) => ({
    scoreIndexes: [{ id: 'i1', key: 'satisfaction', method, ...extras }],
    pages: [
      {
        id: 'p1',
        questions: [
          { id: 'q1', scoring: { indexId: 'i1', weight: 1 } },
          { id: 'q2', scoring: { indexId: 'i1', weight: 3 } },
        ],
      },
    ],
  });

  it('روش مجموع را محاسبه می‌کند', () => {
    expect(engine.calculate(structure('sum'), { q1: 4, q2: 6 })).toEqual({
      satisfaction: 10,
    });
  });

  it('روش میانگین را محاسبه می‌کند', () => {
    expect(engine.calculate(structure('avg'), { q1: 4, q2: 6 })).toEqual({
      satisfaction: 5,
    });
  });

  it('روش میانگین وزنی وزن هر سوال را اعمال می‌کند', () => {
    // (4×1 + 6×3) / (1+3) = 5.5
    expect(engine.calculate(structure('weighted'), { q1: 4, q2: 6 })).toEqual({
      satisfaction: 5.5,
    });
  });

  it('روش درصدی را نسبت به maxScore محاسبه می‌کند', () => {
    expect(
      engine.calculate(structure('percent', { maxScore: 20 }), {
        q1: 4,
        q2: 6,
      }),
    ).toEqual({ satisfaction: 50 });
  });

  it('سوال بدون پاسخ را نادیده می‌گیرد', () => {
    expect(engine.calculate(structure('avg'), { q1: 4 })).toEqual({
      satisfaction: 4,
    });
  });

  it('وقتی هیچ پاسخی نیست صفر برمی‌گرداند', () => {
    expect(engine.calculate(structure('avg'), {})).toEqual({
      satisfaction: 0,
    });
  });

  it('سوال بدون شاخص در محاسبه اثر ندارد', () => {
    const s = {
      scoreIndexes: [{ id: 'i1', key: 'satisfaction', method: 'sum' as const }],
      pages: [
        {
          id: 'p1',
          questions: [
            { id: 'q1', scoring: { indexId: 'i1' } },
            { id: 'qX' }, // بدون scoring
          ],
        },
      ],
    };
    expect(engine.calculate(s, { q1: 3, qX: 100 })).toEqual({
      satisfaction: 3,
    });
  });

  it('وزن گزینه‌ی انتخابی را می‌خواند', () => {
    const s = {
      scoreIndexes: [{ id: 'i1', key: 'q', method: 'sum' as const }],
      pages: [
        {
          id: 'p1',
          questions: [
            {
              id: 'q1',
              scoring: { indexId: 'i1' },
              choices: [
                { id: 'c1', weight: 7 },
                { id: 'c2', weight: 2 },
              ],
            },
          ],
        },
      ],
    };
    expect(engine.calculate(s, { q1: 'c1' })).toEqual({ q: 7 });
  });

  it('پاسخ چندانتخابی وزن گزینه‌ها را جمع می‌زند', () => {
    const s = {
      scoreIndexes: [{ id: 'i1', key: 'q', method: 'sum' as const }],
      pages: [
        {
          id: 'p1',
          questions: [
            {
              id: 'q1',
              scoring: { indexId: 'i1' },
              choices: [
                { id: 'c1', weight: 7 },
                { id: 'c2', weight: 2 },
              ],
            },
          ],
        },
      ],
    };
    expect(engine.calculate(s, { q1: ['c1', 'c2'] })).toEqual({ q: 9 });
  });

  it('پاسخ بولی را به ۰/۱ تبدیل می‌کند', () => {
    expect(engine.calculate(structure('sum'), { q1: true, q2: false })).toEqual(
      { satisfaction: 1 },
    );
  });

  it('عدد به شکل رشته را می‌پذیرد', () => {
    expect(engine.calculate(structure('sum'), { q1: '4', q2: '6' })).toEqual({
      satisfaction: 10,
    });
  });

  it('فرم بدون شاخص خروجی خالی می‌دهد', () => {
    expect(engine.calculate({ pages: [] }, { q1: 5 })).toEqual({});
  });
});

describe('عضویت اعلام‌شده از سمت شاخص', () => {
  const engine = new ScoreEngineService();

  /**
   * قالب‌های آماده عضویت را روی خود شاخص می‌نویسند نه روی تک‌تک سوال‌ها.
   * پیش از این فقط `scoring.indexId` خوانده می‌شد، پس امتیاز قالب هتل همیشه
   * صفر بود بدون آنکه خطایی بدهد.
   */
  const structure = {
    pages: [
      {
        id: 'p1',
        questions: [{ id: 'a' }, { id: 'b' }, { id: 'note' }],
      },
    ],
    scoreIndexes: [
      {
        id: 'sat',
        key: 'رضایت کلی',
        method: 'avg' as const,
        questionIds: ['a', 'b'],
      },
    ],
  };

  it('سوال‌های فهرست‌شده در شاخص را می‌شمارد', () => {
    expect(
      engine.calculate(structure, { a: 8, b: 6, note: 'خوب بود' }),
    ).toEqual({ 'رضایت کلی': 7 });
  });

  it('سوال بیرون از فهرست را وارد امتیاز نمی‌کند', () => {
    expect(engine.calculate(structure, { note: 'خوب بود' })).toEqual({
      'رضایت کلی': 0,
    });
  });
});
