jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import { AnalyticsService } from './analytics.service';
import type { ResponseEntity } from '../database/entities/response.entity';

/**
 * سرویس فقط برای خواندن به مخزن‌ها نیاز دارد؛ اینجا نسخه‌ی فرم و پاسخ‌ها
 * مستقیم داده می‌شوند تا تجمیع بدون پایگاه‌داده آزموده شود.
 */
/** پارامترهای ثبت‌شده‌ی آخرین پرس‌وجو؛ برای بررسی اعمال بازه. */
const lastParams: Record<string, unknown> = {};

function makeService(structure: unknown, rows: Array<Partial<ResponseEntity>>) {
  for (const key of Object.keys(lastParams)) delete lastParams[key];

  // سازنده‌ی پرس‌وجوی زنجیره‌ای: هر متد خودش را برمی‌گرداند تا ترتیب
  // فراخوانی‌ها روی تست اثر نگذارد.
  const qb: Record<string, unknown> = {
    innerJoin: () => qb,
    where: () => qb,
    andWhere: (_sql: string, params: Record<string, unknown>) => {
      Object.assign(lastParams, params);
      return qb;
    },
    orderBy: () => qb,
    getMany: async () => rows,
  };

  return new AnalyticsService(
    { createQueryBuilder: () => qb } as never,
    { findOne: async () => ({ structure }) } as never,
  );
}

function build(structure: unknown, rows: Array<Partial<ResponseEntity>>) {
  return makeService(structure, rows).forForm('form-1');
}

function response(
  answers: Record<string, unknown>,
  extra: Partial<ResponseEntity> = {},
): Partial<ResponseEntity> {
  return {
    status: 'completed' as never,
    createdAt: new Date('2025-08-30T10:00:00Z'),
    answers,
    scores: {},
    ...extra,
  };
}

describe('AnalyticsService', () => {
  const structure = {
    pages: [
      {
        id: 'p1',
        questions: [
          { id: 'q_food', type: 'multiple_choice', title: 'غذا' },
          {
            id: 'q_rate',
            type: 'rating',
            title: 'امتیاز',
            meta: { min: 0, max: 10 },
          },
          { id: 'q_nps', type: 'nps', title: 'توصیه' },
          { id: 'q_yes', type: 'boolean', title: 'دوباره؟' },
          { id: 'q_note', type: 'long_text', title: 'توضیح' },
          { id: 'q_sig', type: 'signature', title: 'امضا' },
        ],
      },
    ],
    scoreIndexes: [
      { id: 'sat', key: 'رضایت کلی', method: 'avg', maxScore: 10 },
    ],
  };

  it('گزینه‌ها را با برچسب خوانا می‌شمارد، نه با شناسه', async () => {
    const result = await build(structure, [
      response({ q_food: 'خوب' }),
      response({ q_food: 'خوب' }),
      response({ q_food: 'بد' }),
    ]);

    const food = result.questions.find((q) => q.id === 'q_food');
    expect(food?.title).toBe('غذا');
    expect(food?.bars).toEqual([
      { label: 'خوب', count: 2, percent: 66.67 },
      { label: 'بد', count: 1, percent: 33.33 },
    ]);
  });

  it('«بله/خیر» را به‌جای yes/no نشان می‌دهد', async () => {
    const result = await build(structure, [
      response({ q_yes: 'yes' }),
      response({ q_yes: 'no' }),
    ]);
    const labels = result.questions
      .find((q) => q.id === 'q_yes')
      ?.bars.map((b) => b.label);
    expect(labels?.sort()).toEqual(['بله', 'خیر']);
  });

  it('میانگین و کف و سقف مقیاس را می‌دهد', async () => {
    const result = await build(structure, [
      response({ q_rate: 8 }),
      response({ q_rate: 6 }),
      response({ q_rate: '10' }),
    ]);
    const rate = result.questions.find((q) => q.id === 'q_rate');
    expect(rate?.chart).toBe('scale');
    expect(rate?.average).toBe(8);
    // سقف از فراداده‌ی سوال می‌آید نه از بیشترین پاسخ؛ وگرنه نمودار با
    // آمدن یک پاسخ جدید کش‌وقوس پیدا می‌کند.
    expect(rate?.scale).toEqual({ min: 0, max: 10 });
  });

  it('NPS را به ترویج‌کننده و منتقد تفکیک می‌کند', async () => {
    const result = await build(structure, [
      response({ q_nps: 10 }),
      response({ q_nps: 9 }),
      response({ q_nps: 7 }),
      response({ q_nps: 3 }),
    ]);
    expect(result.questions.find((q) => q.id === 'q_nps')?.nps).toEqual({
      promoters: 2,
      passives: 1,
      detractors: 1,
      score: 25,
    });
  });

  it('سوال بی‌پاسخ حذف نمی‌شود ولی سوال بدون داده‌ی تجمیع‌پذیر حذف می‌شود', async () => {
    const result = await build(structure, [response({ q_food: 'خوب' })]);
    const ids = result.questions.map((q) => q.id);
    expect(ids).toContain('q_rate');
    // امضا داده‌ی قابل شمارش ندارد؛ نمایشش فقط جای گزارش را می‌گیرد.
    expect(ids).not.toContain('q_sig');
  });

  it('پاسخ ناتمام در آمار سوال‌ها نمی‌آید ولی در روند «شروع‌شده» هست', async () => {
    const result = await build(structure, [
      response({ q_food: 'خوب' }),
      response({ q_food: 'بد' }, { status: 'partial' as never }),
    ]);
    expect(result.totalResponses).toBe(1);
    expect(result.questions.find((q) => q.id === 'q_food')?.answered).toBe(1);
    expect(result.trend).toEqual([
      { date: '2025-08-30', jalali: '1404/06/08', started: 2, completed: 1 },
    ]);
  });

  it('میانگین شاخص‌ها را از امتیاز ثبت‌شده می‌گیرد', async () => {
    const result = await build(structure, [
      response({}, { scores: { 'رضایت کلی': 8 } }),
      response({}, { scores: { 'رضایت کلی': 6 } }),
    ]);
    expect(result.scores).toEqual([
      // «نرخ شاخص»: میانگین ۷ روی سقف ۱۰ یعنی ۷۰٪.
      { key: 'رضایت کلی', average: 7, count: 2, maxScore: 10, rate: 70 },
    ]);
  });

  describe('بازه‌ی زمانی', () => {
    it('بازه را روی پرس‌وجو اعمال می‌کند و روز پایان را کامل می‌گیرد', async () => {
      const service = makeService(structure, []);
      const result = await service.forForm('form-1', {
        from: '2025-08-01',
        to: '2025-08-31',
      });

      expect(lastParams.from).toEqual(new Date('2025-08-01T00:00:00.000Z'));
      // پایانِ روز، نه ابتدای آن: کاربری که «تا ۳۱ام» می‌گوید انتظار دارد
      // پاسخ‌های همان روز هم بیایند.
      expect(lastParams.to).toEqual(new Date('2025-08-31T23:59:59.999Z'));

      expect(result.range).toEqual({
        from: '2025-08-01',
        to: '2025-08-31',
        fromJalali: '1404/05/10',
        toJalali: '1404/06/09',
      });
    });

    it('بدون بازه هیچ شرط تاریخی اضافه نمی‌شود', async () => {
      await makeService(structure, []).forForm('form-1');
      expect(lastParams).toEqual({});
    });
  });

  describe('کلیدواژه‌ها', () => {
    it('از پاسخ متن آزاد کلیدواژه می‌گیرد', async () => {
      const result = await build(structure, [
        response({ q_note: 'صبحانه عالی بود' }),
        response({ q_note: 'صبحانه ضعیف بود' }),
      ]);
      const note = result.questions.find((q) => q.id === 'q_note');
      expect(note?.keywords.map((k) => k.word)).toContain('صبحانه');
    });

    it('از شماره تلفن کلیدواژه نمی‌سازد', async () => {
      // «متنی» بودن کافی نیست؛ شمردن تکه‌های شماره هیچ الگویی نشان نمی‌دهد.
      const withPhone = {
        pages: [
          {
            id: 'p1',
            questions: [{ id: 'q_tel', type: 'mobile', title: 'تلفن' }],
          },
        ],
      };
      const result = await build(withPhone, [
        response({ q_tel: '09121112233' }),
        response({ q_tel: '09121112233' }),
      ]);
      expect(result.questions.find((q) => q.id === 'q_tel')?.keywords).toEqual(
        [],
      );
    });
  });
});
