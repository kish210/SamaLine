jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import { AnalyticsService } from './analytics.service';
import type { ResponseEntity } from '../database/entities/response.entity';

/**
 * سرویس فقط برای خواندن به مخزن‌ها نیاز دارد؛ اینجا نسخه‌ی فرم و پاسخ‌ها
 * مستقیم داده می‌شوند تا تجمیع بدون پایگاه‌داده آزموده شود.
 */
function build(structure: unknown, rows: Array<Partial<ResponseEntity>>) {
  const service = new AnalyticsService(
    {
      createQueryBuilder: () => ({
        innerJoin: () => ({
          where: () => ({
            orderBy: () => ({ getMany: async () => rows }),
          }),
        }),
      }),
    } as never,
    { findOne: async () => ({ structure }) } as never,
  );
  return service.forForm('form-1');
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
    scoreIndexes: [{ id: 'sat', key: 'رضایت کلی', method: 'avg' }],
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
      { key: 'رضایت کلی', average: 7, count: 2 },
    ]);
  });
});
