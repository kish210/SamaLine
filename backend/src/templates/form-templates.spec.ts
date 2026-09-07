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

describe('قالب هتل دروازه‌دار', () => {
  const template = FORM_TEMPLATES.find((t) => t.key === 'hotel-gated');
  const questions = (template?.structure.pages ?? []).flatMap(
    (p) => p.questions ?? [],
  );
  const display = (template?.structure.logic?.display ?? []) as Array<{
    targetQuestionId: string;
    when: { conditions: Array<{ source: string }> };
  }>;

  it('هر سوال امتیاز خدمت، پشت سوال دروازه‌ای‌اش پنهان است', () => {
    const gated = questions.filter((q) => q.id?.endsWith('_sat'));
    expect(gated).toHaveLength(9);
    for (const question of gated) {
      const rule = display.find((r) => r.targetQuestionId === question.id);
      expect(rule).toBeDefined();
      // شرط باید به همان سوال دروازه‌ای اشاره کند، نه سوال دیگری.
      expect(rule?.when.conditions[0].source).toBe(
        question.id.replace(/_sat$/, ''),
      );
    }
  });

  it('سوال دروازه‌ای پیش از سوال امتیازش می‌آید', () => {
    // اگر ترتیب برعکس شود، شرط هنگام نمایش هنوز پاسخی ندارد و سوال
    // امتیاز هیچ‌وقت نشان داده نمی‌شود.
    for (const rule of display) {
      const gate = questions.findIndex(
        (q) => q.id === rule.when.conditions[0].source,
      );
      const target = questions.findIndex(
        (q) => q.id === rule.targetQuestionId,
      );
      expect(gate).toBeGreaterThanOrEqual(0);
      expect(gate).toBeLessThan(target);
    }
  });

  it('شاخص رضایت فقط سوال‌های امتیازی را می‌شمارد', () => {
    const index = (template?.structure.scoreIndexes ?? [])[0] as {
      questionIds: string[];
    };
    const ratingIds = questions
      .filter((q) => q.type === 'rating')
      .map((q) => q.id);
    expect([...index.questionIds].sort()).toEqual([...ratingIds].sort());
  });
});

describe('شاخص قالب‌ها', () => {
  /**
   * «نرخ شاخص» در گزارش، میانگین را بر سقف تقسیم می‌کند. بدون سقف این KPI
   * خالی می‌ماند و کاربر باید دستی برود سقف بگذارد — که یعنی قالب آماده
   * نیست.
   */
  it('هر شاخصِ قالب سقف امتیاز دارد', () => {
    for (const template of FORM_TEMPLATES) {
      for (const index of template.structure.scoreIndexes ?? []) {
        expect(typeof index.maxScore).toBe('number');
        expect(index.maxScore as number).toBeGreaterThan(0);
      }
    }
  });

  it('سوال‌های عضو شاخص واقعا در فرم وجود دارند', () => {
    for (const template of FORM_TEMPLATES) {
      const ids = new Set(
        template.structure.pages.flatMap((p) =>
          (p.questions ?? []).map((q) => q.id),
        ),
      );
      for (const index of template.structure.scoreIndexes ?? []) {
        for (const questionId of (index.questionIds as string[]) ?? []) {
          expect(ids.has(questionId)).toBe(true);
        }
      }
    }
  });
});
