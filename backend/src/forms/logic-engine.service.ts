import { Injectable } from '@nestjs/common';
import {
  type DisplayRule,
  type FormStructure,
  type LogicCondition,
  type LogicConditionGroup,
  type SkipRule,
  isConditionGroup,
} from './logic-types';

/**
 * اعتبارسنجی ساختاری منطق فرم: ارجاع‌های نامعتبر، حلقه‌ی بی‌نهایت،
 * صفحه‌ی غیرقابل دسترس و جایگذاری Piping.
 *
 * اجرای منطق در زمان پاسخ‌دهی در LogicRuntimeService است.
 */
@Injectable()
export class LogicEngineService {
  analyzeStructure(structure: FormStructure) {
    const pages = structure.pages ?? [];
    const pageIds = new Set(pages.map((p) => p.id));
    const questionIds = new Set(
      pages.flatMap((p) => (p.questions ?? []).map((q) => q.id)),
    );

    const errors: string[] = [];
    const warnings: string[] = [];

    const displayRules = structure.logic?.display ?? [];
    displayRules.forEach((rule, i) => {
      if (rule.targetQuestionId && !questionIds.has(rule.targetQuestionId)) {
        errors.push(`display[${i}] targetQuestionId نامعتبر است`);
      }
      if (rule.targetPageId && !pageIds.has(rule.targetPageId)) {
        errors.push(`display[${i}] targetPageId نامعتبر است`);
      }
      if (!rule.targetQuestionId && !rule.targetPageId) {
        errors.push(`display[${i}] هدف (سوال یا صفحه) ندارد`);
      }
      if (rule.sourceQuestionId && !questionIds.has(rule.sourceQuestionId)) {
        errors.push(`display[${i}] sourceQuestionId نامعتبر است`);
      }
      this.collectSourceErrors(rule.when, questionIds).forEach((source) =>
        errors.push(`display[${i}] منبع شرط «${source}» نامعتبر است`),
      );
    });

    const skipRules = structure.logic?.skip ?? [];
    skipRules.forEach((rule, i) => {
      if (rule.fromQuestionId && !questionIds.has(rule.fromQuestionId)) {
        errors.push(`skip[${i}] fromQuestionId نامعتبر است`);
      }
      if (rule.fromPageId && !pageIds.has(rule.fromPageId)) {
        errors.push(`skip[${i}] fromPageId نامعتبر است`);
      }
      if (!rule.fromQuestionId && !rule.fromPageId) {
        errors.push(`skip[${i}] مبدا (سوال یا صفحه) ندارد`);
      }
      if (rule.toQuestionId && !questionIds.has(rule.toQuestionId)) {
        errors.push(`skip[${i}] toQuestionId نامعتبر است`);
      }
      if (rule.toPageId && !pageIds.has(rule.toPageId)) {
        errors.push(`skip[${i}] toPageId نامعتبر است`);
      }
      if (!rule.toQuestionId && !rule.toPageId && !rule.toEnd) {
        errors.push(`skip[${i}] مقصد ندارد`);
      }
      if (
        rule.toQuestionId &&
        rule.fromQuestionId &&
        rule.toQuestionId === rule.fromQuestionId
      ) {
        errors.push(`skip[${i}] حلقه مستقیم دارد`);
      }
      this.collectSourceErrors(rule.when, questionIds).forEach((source) =>
        errors.push(`skip[${i}] منبع شرط «${source}» نامعتبر است`),
      );
    });

    const pageGraph = this.buildPageGraph(structure);
    const startPageId = pages[0]?.id;
    if (startPageId) {
      const visited = new Set<string>();
      const stack: string[] = [startPageId];
      while (stack.length) {
        const cur = stack.pop() as string;
        if (visited.has(cur)) continue;
        visited.add(cur);
        (pageGraph.get(cur) ?? new Set()).forEach((next) => stack.push(next));
      }

      pages.forEach((p) => {
        if (!visited.has(p.id)) warnings.push(`صفحه ${p.id} غیرقابل دسترس است`);
      });

      if (this.hasCycle(pageGraph)) {
        warnings.push('احتمال حلقه بی‌نهایت در مسیر پرش وجود دارد');
      }
    }

    return { errors, warnings, isValid: errors.length === 0 };
  }

  /** گراف مسیر صفحات: ترتیب پیش‌فرض به‌علاوه‌ی یال‌های پرش. */
  private buildPageGraph(structure: FormStructure) {
    const pages = structure.pages ?? [];
    const graph = new Map<string, Set<string>>();

    pages.forEach((p, idx) => {
      if (!graph.has(p.id)) graph.set(p.id, new Set());
      if (idx < pages.length - 1) graph.get(p.id)?.add(pages[idx + 1].id);
    });

    const questionToPage = new Map<string, string>();
    pages.forEach((p) =>
      (p.questions ?? []).forEach((q) => questionToPage.set(q.id, p.id)),
    );

    (structure.logic?.skip ?? []).forEach((rule) => {
      const fromPage =
        rule.fromPageId ??
        (rule.fromQuestionId
          ? questionToPage.get(rule.fromQuestionId)
          : undefined);
      const toPage =
        rule.toPageId ??
        (rule.toQuestionId ? questionToPage.get(rule.toQuestionId) : undefined);
      if (fromPage && toPage) {
        if (!graph.has(fromPage)) graph.set(fromPage, new Set());
        graph.get(fromPage)?.add(toPage);
      }
    });

    return graph;
  }

  /**
   * منابع شرط ناموجود را برمی‌گرداند.
   * `param.*` و `score.*` همیشه مجازند چون در زمان اجرا تامین می‌شوند.
   */
  private collectSourceErrors(
    group: LogicConditionGroup | undefined,
    questionIds: Set<string>,
  ): string[] {
    if (!group) return [];
    const invalid: string[] = [];

    const walk = (node: LogicCondition | LogicConditionGroup) => {
      if (isConditionGroup(node)) {
        (node.conditions ?? []).forEach(walk);
        return;
      }
      const source = node.source ?? '';
      if (source.startsWith('param.') || source.startsWith('score.')) return;
      if (!questionIds.has(source)) invalid.push(source);
    };

    (group.conditions ?? []).forEach(walk);
    return invalid;
  }

  private hasCycle(graph: Map<string, Set<string>>) {
    const visiting = new Set<string>();
    const visited = new Set<string>();

    const dfs = (node: string): boolean => {
      if (visiting.has(node)) return true;
      if (visited.has(node)) return false;
      visiting.add(node);
      for (const next of graph.get(node) ?? []) {
        if (dfs(next)) return true;
      }
      visiting.delete(node);
      visited.add(node);
      return false;
    };

    for (const node of graph.keys()) {
      if (dfs(node)) return true;
    }

    return false;
  }

  /**
   * نمای فلوچارت مسیر فرم (بند ۵ سند): گره‌ها و یال‌های
   * ترتیبی و شرطی، برای رسم در ویرایشگر گرافیکی.
   */
  buildFlowGraph(structure: FormStructure) {
    const pages = structure.pages ?? [];
    const questionToPage = new Map<string, string>();
    pages.forEach((p) =>
      (p.questions ?? []).forEach((q) => questionToPage.set(q.id, p.id)),
    );

    const nodes = pages.map((page) => ({
      id: page.id,
      title: page.title ?? page.id,
      questionCount: (page.questions ?? []).length,
    }));

    const edges: Array<{
      from: string;
      to: string | null;
      kind: 'sequential' | 'skip';
      conditional: boolean;
    }> = [];

    pages.forEach((page, idx) => {
      if (idx < pages.length - 1) {
        edges.push({
          from: page.id,
          to: pages[idx + 1].id,
          kind: 'sequential',
          conditional: false,
        });
      }
    });

    (structure.logic?.skip ?? []).forEach((rule: SkipRule) => {
      const from =
        rule.fromPageId ??
        (rule.fromQuestionId
          ? questionToPage.get(rule.fromQuestionId)
          : undefined);
      if (!from) return;
      const to = rule.toEnd
        ? null
        : (rule.toPageId ??
          (rule.toQuestionId
            ? questionToPage.get(rule.toQuestionId)
            : undefined) ??
          null);
      edges.push({
        from,
        to,
        kind: 'skip',
        conditional: Boolean(rule.when),
      });
    });

    const conditionalQuestions = (structure.logic?.display ?? [])
      .filter((rule: DisplayRule) => rule.targetQuestionId)
      .map((rule: DisplayRule) => rule.targetQuestionId as string);

    return { nodes, edges, conditionalQuestions };
  }

  applyPiping(
    text: string,
    answers: Record<string, unknown>,
    params: Record<string, unknown> = {},
  ) {
    const normalizeTokenValue = (value: unknown) => {
      if (value == null) return '';
      if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      ) {
        return String(value);
      }
      return JSON.stringify(value);
    };

    return text.replace(/\{\{([^}]+)\}\}/g, (_, rawToken: string) => {
      // `[^}]+` فاصله‌های اطراف را هم می‌بلعد، پس توکن باید trim شود
      // تا `{{ q1 }}` معادل `{{q1}}` باشد.
      const token = rawToken.trim();
      if (token.startsWith('param.')) {
        const key = token.slice('param.'.length);
        return normalizeTokenValue(params[key]);
      }
      return normalizeTokenValue(answers[token]);
    });
  }
}
