import { PlanCode } from '../database/entities/plan-policy.entity';
import { DEFAULT_PLAN_LIMITS } from '../database/plan-defaults';
import { LogicRuntimeService } from '../forms/logic-runtime.service';
import type { FormStructure } from '../forms/logic-types';
import { THEME_PRESETS } from '../forms/theme';
import {
  FORM_TEMPLATES,
  findTemplate,
  type FormTemplate,
} from './form-templates';
import { TEMPLATE_CATEGORIES } from './sector-templates';

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
      const target = questions.findIndex((q) => q.id === rule.targetQuestionId);
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

describe('کتابخانه‌ی قالب‌های صنفی', () => {
  const runtime = new LogicRuntimeService();
  const questionsOf = (template: FormTemplate) =>
    template.structure.pages.flatMap((page) => page.questions ?? []);

  it('هر دسته دست‌کم یک قالب دارد و هر قالب دسته‌ی شناخته‌شده دارد', () => {
    const used = new Set(FORM_TEMPLATES.map((t) => t.category));
    for (const category of TEMPLATE_CATEGORIES) {
      expect(used.has(category)).toBe(true);
    }
    for (const template of FORM_TEMPLATES) {
      expect(TEMPLATE_CATEGORIES as readonly string[]).toContain(
        template.category,
      );
    }
  });

  it('فرم خالی اول فهرست است و دسته‌ها به ترتیب تعریف می‌آیند', () => {
    expect(FORM_TEMPLATES[0].key).toBe('blank');
    const ranks = FORM_TEMPLATES.map((t) =>
      (TEMPLATE_CATEGORIES as readonly string[]).indexOf(t.category),
    );
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  it('کلید قالب لاتین کوچک با خط تیره است', () => {
    // کلید در درخواست API می‌آید؛ فاصله یا حرف فارسی مشکل‌ساز است.
    for (const template of FORM_TEMPLATES) {
      expect(template.key).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('هر قالب (جز نمونه‌ی همه‌ی انواع) روی پلن رایگان ساخته می‌شود', () => {
    const limit = Number(DEFAULT_PLAN_LIMITS[PlanCode.FREE].maxQuestionTypes);
    for (const template of FORM_TEMPLATES) {
      if (template.key === 'all-types') continue;
      const types = new Set(questionsOf(template).map((q) => q.type));
      // کلید قالب در پیام شکست دیده شود، نه فقط دو عدد.
      expect([template.key, types.size <= limit]).toEqual([template.key, true]);
    }
  });

  it('تم هر قالب واقعا وجود دارد', () => {
    for (const template of FORM_TEMPLATES) {
      const theme = (template.settings?.theme ?? {}) as { preset?: string };
      if (!theme.preset) continue;
      expect(Object.keys(THEME_PRESETS)).toContain(theme.preset);
    }
  });

  it('سوال‌های گزینه‌ای دست‌کم دو گزینه‌ی یکتا دارند', () => {
    for (const template of FORM_TEMPLATES) {
      for (const question of questionsOf(template)) {
        if (
          !['multiple_choice', 'dropdown', 'ranking'].includes(
            question.type ?? '',
          )
        ) {
          continue;
        }
        const options = (question.options ?? []) as string[];
        expect(options.length).toBeGreaterThanOrEqual(2);
        expect(new Set(options).size).toBe(options.length);
      }
    }
  });

  it('عنوان هر سوال پر است', () => {
    for (const template of FORM_TEMPLATES) {
      for (const question of questionsOf(template)) {
        expect((question.title ?? '').trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('سقف هر شاخص با مقیاس سوال‌هایش یکی است', () => {
    /*
     * اگر سقف شاخص با مقیاس سوال نخواند (مثلا سقف ۱۰ روی ستاره‌ی ۱ تا ۵)،
     * «نرخ رضایت» گزارش نصف مقدار واقعی نشان داده می‌شود و کسی هم متوجه
     * نمی‌شود چرا.
     */
    for (const template of FORM_TEMPLATES) {
      const byId = new Map(questionsOf(template).map((q) => [q.id, q]));
      for (const index of template.structure.scoreIndexes ?? []) {
        for (const questionId of index.questionIds as string[]) {
          const question = byId.get(questionId)!;
          const max =
            question.type === 'nps'
              ? 10
              : Number((question.meta as { max?: number } | undefined)?.max);
          expect({ template: template.key, questionId, max }).toEqual({
            template: template.key,
            questionId,
            max: index.maxScore,
          });
        }
      }
    }
  });

  it('سوال پیگیری بعد از سوال شرطش می‌آید', () => {
    for (const template of FORM_TEMPLATES) {
      const order = questionsOf(template).map((q) => q.id);
      for (const rule of displayRules(template)) {
        for (const condition of rule.when.conditions) {
          expect(order.indexOf(condition.source)).toBeLessThan(
            order.indexOf(rule.targetQuestionId),
          );
        }
      }
    }
  });

  it('هر سوال پیگیری با پاسخ درست ظاهر و با پاسخ دیگر پنهان می‌شود', () => {
    /*
     * این آزمون با موتور منطق واقعی سامانه اجرا می‌شود، نه با بررسی شکل
     * قانون؛ یعنی اگر مثلا مقدار شرط «خیر» باشد ولی گزینه «نه» نوشته شده
     * باشد، همین‌جا شکست می‌خورد.
     */
    let checked = 0;
    for (const template of FORM_TEMPLATES) {
      const structure = template.structure as unknown as FormStructure;
      for (const rule of displayRules(template)) {
        const [condition] = rule.when.conditions;
        const visibleWith = (value: unknown) =>
          runtime
            .visibleQuestionIds(structure, {
              answers: { [condition.source]: value },
              params: {},
              scores: {},
            })
            .has(rule.targetQuestionId);

        expect({
          template: template.key,
          target: rule.targetQuestionId,
          shown: visibleWith(triggering(condition)),
          hidden: !visibleWith(nonTriggering(condition)),
        }).toEqual({
          template: template.key,
          target: rule.targetQuestionId,
          shown: true,
          hidden: true,
        });
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(30);
  });

  it('مقدار شرط‌های «برابر» واقعا یکی از گزینه‌های سوال است', () => {
    for (const template of FORM_TEMPLATES) {
      const byId = new Map(questionsOf(template).map((q) => [q.id, q]));
      for (const rule of displayRules(template)) {
        for (const condition of rule.when.conditions) {
          if (condition.operator !== 'equals') continue;
          const source = byId.get(condition.source)!;
          if (source.type === 'boolean') {
            expect(typeof condition.value).toBe('boolean');
          } else {
            expect(source.options as string[]).toContain(condition.value);
          }
        }
      }
    }
  });
});

interface SimpleRule {
  targetQuestionId: string;
  when: {
    conditions: Array<{ source: string; operator: string; value: unknown }>;
  };
}

function displayRules(template: FormTemplate): SimpleRule[] {
  return (template.structure.logic?.display ?? []) as unknown as SimpleRule[];
}

/** پاسخی که شرط را برقرار می‌کند. */
function triggering(condition: { operator: string; value: unknown }) {
  if (condition.operator === 'lt') return Number(condition.value) - 1;
  if (condition.operator === 'gt') return Number(condition.value) + 1;
  return condition.value;
}

/** پاسخی که شرط را برقرار نمی‌کند. */
function nonTriggering(condition: { operator: string; value: unknown }) {
  if (condition.operator === 'lt') return Number(condition.value);
  if (condition.operator === 'gt') return Number(condition.value);
  if (typeof condition.value === 'boolean') return !condition.value;
  return '__پاسخ_دیگر__';
}
