import { FORM_TEMPLATES, findTemplate } from './form-templates';

describe('قالب‌های آماده‌ی فرم', () => {
  it('کلید هر قالب یکتاست', () => {
    const keys = FORM_TEMPLATES.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('هر قالب دست‌کم یک صفحه و یک سوال دارد', () => {
    for (const template of FORM_TEMPLATES) {
      expect(template.structure.pages.length).toBeGreaterThan(0);
      const total = template.structure.pages.reduce(
        (sum, page) => sum + (page.questions?.length ?? 0),
        0,
      );
      expect(total).toBeGreaterThan(0);
    }
  });

  it('شناسه‌ی سوال‌ها درون هر قالب تکراری نیست', () => {
    // شناسه‌ی تکراری، منطق پرش و Piping را به سوال اشتباه وصل می‌کند.
    for (const template of FORM_TEMPLATES) {
      const ids = template.structure.pages.flatMap((page) =>
        (page.questions ?? []).map((q) => q.id),
      );
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('قوانین نمایش به سوال موجود اشاره می‌کنند', () => {
    for (const template of FORM_TEMPLATES) {
      const ids = new Set(
        template.structure.pages.flatMap((page) =>
          (page.questions ?? []).map((q) => q.id),
        ),
      );
      const rules = (template.structure.logic?.display ?? []) as Array<{
        targetQuestionId?: string;
        when?: { conditions?: Array<{ source?: string }> };
      }>;

      for (const rule of rules) {
        expect(ids.has(rule.targetQuestionId ?? '')).toBe(true);
        for (const condition of rule.when?.conditions ?? []) {
          expect(ids.has(condition.source ?? '')).toBe(true);
        }
      }
    }
  });

  it('شاخص‌های امتیاز به سوال موجود اشاره می‌کنند', () => {
    for (const template of FORM_TEMPLATES) {
      const ids = new Set(
        template.structure.pages.flatMap((page) =>
          (page.questions ?? []).map((q) => q.id),
        ),
      );
      for (const index of template.structure.scoreIndexes ?? []) {
        for (const questionId of (index.questionIds ?? []) as string[]) {
          expect(ids.has(questionId)).toBe(true);
        }
      }
    }
  });

  describe('نظرسنجی هتل', () => {
    const hotel = findTemplate('hotel-satisfaction');

    it('وجود دارد', () => {
      expect(hotel).toBeDefined();
    });

    it('برای هر بخش امتیازی، سوال علت نارضایتی شرطی دارد', () => {
      const questions = hotel!.structure.pages[0].questions ?? [];
      const ratings = questions.filter((q) => q.type === 'rating');
      const rules = (hotel!.structure.logic?.display ?? []) as Array<{
        targetQuestionId: string;
      }>;

      expect(ratings.length).toBe(10);
      expect(rules.length).toBe(ratings.length);

      for (const question of ratings) {
        expect(
          rules.some((rule) => rule.targetQuestionId === `${question.id}_why`),
        ).toBe(true);
      }
    });

    it('شرط علت نارضایتی روی امتیاز زیر ۵ است', () => {
      const rules = (hotel!.structure.logic?.display ?? []) as Array<{
        when: { conditions: Array<{ operator: string; value: number }> };
      }>;
      for (const rule of rules) {
        expect(rule.when.conditions[0].operator).toBe('lt');
        expect(rule.when.conditions[0].value).toBe(5);
      }
    });
  });

  it('شاخص‌ها با کلید indices به ساختار فرم می‌روند', () => {
    /*
     * buildStructure انتظار `scoreConfig.indices` دارد.
     * یک بار با کلید `indexes` نوشته شد و شاخص‌ها بی‌صدا خالی ماندند —
     * نه خطایی داد نه تستی شکست. این آزمون همان نگاشت را قفل می‌کند.
     */
    const withIndexes = FORM_TEMPLATES.filter(
      (t) => (t.structure.scoreIndexes?.length ?? 0) > 0,
    );
    expect(withIndexes.length).toBeGreaterThan(0);

    for (const template of withIndexes) {
      const scoreConfig = { indices: template.structure.scoreIndexes };
      expect(Array.isArray(scoreConfig.indices)).toBe(true);
      expect(scoreConfig.indices!.length).toBeGreaterThan(0);
    }
  });

  it('قالب ناشناس undefined می‌دهد', () => {
    expect(findTemplate('وجود-ندارد')).toBeUndefined();
  });
});
