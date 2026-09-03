import { Injectable } from '@nestjs/common';
import {
  type DisplayRule,
  type FormPageNode,
  type FormStructure,
  type LogicCondition,
  type LogicConditionGroup,
  type LogicContext,
  type SkipRule,
  isConditionGroup,
} from './logic-types';

/** نتیجه‌ی تعیین گام بعدی در پیمایش فرم. */
export interface NextStepResult {
  /** شناسه‌ی صفحه‌ی بعد؛ در صورت پایان فرم null. */
  nextPageId: string | null;
  finished: boolean;
  /** دلیل تصمیم — برای اشکال‌زدایی و نمایش در فلوچارت. */
  reason: 'skip_rule' | 'sequential' | 'end_of_form';
}

/**
 * اجرای منطق فرم در زمان پاسخ‌دهی: تعیین سوالات قابل نمایش،
 * مسیر پرش و پاک‌سازی پاسخ سوالات مخفی.
 *
 * اعتبارسنجی ساختاری (حلقه، ارجاع نامعتبر) در LogicEngineService است؛
 * این سرویس فقط اجرای زمان اجرا را بر عهده دارد.
 */
@Injectable()
export class LogicRuntimeService {
  /** مقدار یک منبع شرط را از زمینه می‌خواند. */
  resolveSource(source: string, context: LogicContext): unknown {
    if (source.startsWith('param.')) {
      return context.params?.[source.slice('param.'.length)];
    }
    if (source.startsWith('score.')) {
      return context.scores?.[source.slice('score.'.length)];
    }
    return context.answers[source];
  }

  evaluateCondition(condition: LogicCondition, context: LogicContext): boolean {
    const actual = this.resolveSource(condition.source, context);

    switch (condition.operator) {
      case 'is_empty':
        return this.isEmpty(actual);
      case 'is_not_empty':
        return !this.isEmpty(actual);
      case 'equals':
        return this.looseEquals(actual, condition.value);
      case 'not_equals':
        return !this.looseEquals(actual, condition.value);
      case 'contains':
        return this.contains(actual, condition.value);
      case 'starts_with':
        return this.asText(actual).startsWith(this.asText(condition.value));
      case 'gt': {
        const [a, b] = this.numericPair(actual, condition.value);
        return a !== null && b !== null && a > b;
      }
      case 'lt': {
        const [a, b] = this.numericPair(actual, condition.value);
        return a !== null && b !== null && a < b;
      }
      case 'between': {
        const [a, low] = this.numericPair(actual, condition.value);
        const high = this.toNumber(condition.valueTo);
        return (
          a !== null && low !== null && high !== null && a >= low && a <= high
        );
      }
      default:
        return false;
    }
  }

  evaluateGroup(group: LogicConditionGroup, context: LogicContext): boolean {
    const nodes = group.conditions ?? [];
    // گروه خالی خنثی است: نه شرط را رد می‌کند نه تحمیل.
    if (!nodes.length) return true;

    const results = nodes.map((node) =>
      isConditionGroup(node)
        ? this.evaluateGroup(node, context)
        : this.evaluateCondition(node, context),
    );

    return group.combinator === 'or'
      ? results.some(Boolean)
      : results.every(Boolean);
  }

  /** یک قانون نمایش را — در هر دو شکل ساده و گروهی — ارزیابی می‌کند. */
  evaluateRule(rule: DisplayRule | SkipRule, context: LogicContext): boolean {
    if (rule.when) return this.evaluateGroup(rule.when, context);

    const simple = rule as DisplayRule;
    if (!simple.sourceQuestionId || !simple.operator) {
      // قانون بدون شرط یعنی همیشه برقرار.
      return true;
    }

    return this.evaluateCondition(
      {
        source: simple.sourceQuestionId,
        operator: simple.operator,
        value: simple.value,
        valueTo: simple.valueTo,
      },
      context,
    );
  }

  /**
   * شناسه‌ی سوالاتی که با توجه به پاسخ‌های فعلی باید نمایش داده شوند.
   *
   * قاعده: سوالی که هیچ قانونی روی آن نیست، نمایش داده می‌شود.
   * قانون `show` بدون برقراری شرط، سوال را پنهان می‌کند؛
   * قانون `hide` با برقراری شرط، آن را پنهان می‌کند.
   */
  visibleQuestionIds(
    structure: FormStructure,
    context: LogicContext,
  ): Set<string> {
    const rules = structure.logic?.display ?? [];
    const hiddenPages = this.hiddenPageIds(structure, context);
    const visible = new Set<string>();

    for (const page of structure.pages ?? []) {
      if (hiddenPages.has(page.id)) continue;
      for (const question of page.questions ?? []) {
        if (this.isQuestionVisible(question.id, rules, context)) {
          visible.add(question.id);
        }
      }
    }

    return visible;
  }

  /** شناسه‌ی صفحاتی که بر اساس قوانین نمایش پنهان‌اند. */
  hiddenPageIds(structure: FormStructure, context: LogicContext): Set<string> {
    const hidden = new Set<string>();
    const rules = (structure.logic?.display ?? []).filter(
      (rule) => rule.targetPageId,
    );

    for (const page of structure.pages ?? []) {
      const pageRules = rules.filter((rule) => rule.targetPageId === page.id);
      if (!pageRules.length) continue;
      if (!this.passesRules(pageRules, context)) hidden.add(page.id);
    }

    return hidden;
  }

  private isQuestionVisible(
    questionId: string,
    rules: DisplayRule[],
    context: LogicContext,
  ): boolean {
    const own = rules.filter((rule) => rule.targetQuestionId === questionId);
    if (!own.length) return true;
    return this.passesRules(own, context);
  }

  /** چند قانون روی یک هدف: همه باید اجازه بدهند. */
  private passesRules(rules: DisplayRule[], context: LogicContext): boolean {
    for (const rule of rules) {
      const matched = this.evaluateRule(rule, context);
      const action = rule.action ?? 'show';
      if (action === 'show' && !matched) return false;
      if (action === 'hide' && matched) return false;
    }
    return true;
  }

  /**
   * صفحه‌ی بعدی با در نظر گرفتن قوانین پرش و صفحات پنهان.
   * `currentPageId` نامعتبر یا خالی یعنی شروع فرم.
   */
  nextStep(
    structure: FormStructure,
    currentPageId: string | null,
    context: LogicContext,
  ): NextStepResult {
    const pages = structure.pages ?? [];
    if (!pages.length) {
      return { nextPageId: null, finished: true, reason: 'end_of_form' };
    }

    const hidden = this.hiddenPageIds(structure, context);
    const firstVisible = pages.find((p) => !hidden.has(p.id));

    if (!currentPageId) {
      return firstVisible
        ? { nextPageId: firstVisible.id, finished: false, reason: 'sequential' }
        : { nextPageId: null, finished: true, reason: 'end_of_form' };
    }

    const currentIndex = pages.findIndex((p) => p.id === currentPageId);
    if (currentIndex === -1) {
      return firstVisible
        ? { nextPageId: firstVisible.id, finished: false, reason: 'sequential' }
        : { nextPageId: null, finished: true, reason: 'end_of_form' };
    }

    const jump = this.matchingSkipRule(
      structure,
      pages[currentIndex],
      context,
      hidden,
    );
    if (jump) return jump;

    for (let i = currentIndex + 1; i < pages.length; i += 1) {
      if (!hidden.has(pages[i].id)) {
        return {
          nextPageId: pages[i].id,
          finished: false,
          reason: 'sequential',
        };
      }
    }

    return { nextPageId: null, finished: true, reason: 'end_of_form' };
  }

  private matchingSkipRule(
    structure: FormStructure,
    currentPage: FormPageNode,
    context: LogicContext,
    hidden: Set<string>,
  ): NextStepResult | null {
    const pages = structure.pages ?? [];
    const questionIds = new Set((currentPage.questions ?? []).map((q) => q.id));

    const rules = (structure.logic?.skip ?? []).filter(
      (rule) =>
        rule.fromPageId === currentPage.id ||
        (rule.fromQuestionId && questionIds.has(rule.fromQuestionId)),
    );

    for (const rule of rules) {
      if (!this.evaluateRule(rule, context)) continue;

      if (rule.toEnd) {
        return { nextPageId: null, finished: true, reason: 'skip_rule' };
      }

      const targetPageId =
        rule.toPageId ??
        (rule.toQuestionId
          ? pages.find((p) =>
              (p.questions ?? []).some((q) => q.id === rule.toQuestionId),
            )?.id
          : undefined);

      // پرش به صفحه‌ی پنهان نادیده گرفته می‌شود تا پاسخ‌دهنده گیر نکند.
      if (targetPageId && !hidden.has(targetPageId)) {
        return {
          nextPageId: targetPageId,
          finished: false,
          reason: 'skip_rule',
        };
      }
    }

    return null;
  }

  /**
   * پاسخ سوالاتی که در نهایت پنهان بوده‌اند را حذف می‌کند تا داده‌ی
   * ناسازگار («پاسخ به سوالی که هرگز نمایش داده نشده») ذخیره نشود.
   */
  stripHiddenAnswers(
    structure: FormStructure,
    answers: Record<string, unknown>,
    params: Record<string, unknown> = {},
    scores: Record<string, number> = {},
  ): Record<string, unknown> {
    const known = new Set(
      (structure.pages ?? []).flatMap((p) =>
        (p.questions ?? []).map((q) => q.id),
      ),
    );
    // ساختار بدون سوال (فرم خام) نباید پاسخ‌ها را دور بریزد.
    if (!known.size) return { ...answers };

    const visible = this.visibleQuestionIds(structure, {
      answers,
      params,
      scores,
    });

    const cleaned: Record<string, unknown> = {};
    for (const [questionId, value] of Object.entries(answers)) {
      // کلیدهای ناشناخته (پارامتر مخفی و متادیتا) دست‌نخورده می‌مانند.
      if (!known.has(questionId) || visible.has(questionId)) {
        cleaned[questionId] = value;
      }
    }

    return cleaned;
  }

  private isEmpty(value: unknown): boolean {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return value.trim() === '';
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return false;
  }

  /**
   * تبدیل امن به متن: آبجکت به JSON می‌رود تا مقایسه‌ها
   * روی «[object Object]» انجام نشوند.
   */
  private asText(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return String(value);
    }
    return JSON.stringify(value);
  }

  /** مقایسه‌ی نرم: «۵» و ۵ برابرند؛ آرایه شامل بودن را می‌سنجد. */
  private looseEquals(actual: unknown, expected: unknown): boolean {
    if (Array.isArray(actual)) {
      return actual.some((item) => this.looseEquals(item, expected));
    }
    if (actual === expected) return true;
    if (actual == null || expected == null) return false;
    return this.asText(actual) === this.asText(expected);
  }

  private contains(actual: unknown, expected: unknown): boolean {
    if (Array.isArray(actual)) {
      return actual.some((item) => this.looseEquals(item, expected));
    }
    return this.asText(actual).includes(this.asText(expected));
  }

  private toNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  private numericPair(
    actual: unknown,
    expected: unknown,
  ): [number | null, number | null] {
    return [this.toNumber(actual), this.toNumber(expected)];
  }
}
