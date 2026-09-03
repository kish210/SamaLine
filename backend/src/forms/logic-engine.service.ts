import { Injectable } from '@nestjs/common';

type DisplayRule = {
  targetQuestionId: string;
  sourceQuestionId: string;
  operator:
    | 'equals'
    | 'not_equals'
    | 'contains'
    | 'starts_with'
    | 'gt'
    | 'lt'
    | 'between'
    | 'is_empty'
    | 'is_not_empty';
  value?: unknown;
};

type SkipRule = {
  fromQuestionId: string;
  toPageId?: string;
  toQuestionId?: string;
};

type FormStructure = {
  pages?: Array<{ id: string; questions?: Array<{ id: string }> }>;
  logic?: {
    display?: DisplayRule[];
    skip?: SkipRule[];
    pipe?: Array<{ source: string; targetQuestionId: string }>;
  };
};

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
      if (!questionIds.has(rule.targetQuestionId)) {
        errors.push(`display[${i}] targetQuestionId نامعتبر است`);
      }
      if (!questionIds.has(rule.sourceQuestionId)) {
        errors.push(`display[${i}] sourceQuestionId نامعتبر است`);
      }
    });

    const skipRules = structure.logic?.skip ?? [];
    skipRules.forEach((rule, i) => {
      if (!questionIds.has(rule.fromQuestionId)) {
        errors.push(`skip[${i}] fromQuestionId نامعتبر است`);
      }
      if (rule.toQuestionId && !questionIds.has(rule.toQuestionId)) {
        errors.push(`skip[${i}] toQuestionId نامعتبر است`);
      }
      if (rule.toPageId && !pageIds.has(rule.toPageId)) {
        errors.push(`skip[${i}] toPageId نامعتبر است`);
      }
      if (
        rule.toQuestionId &&
        rule.fromQuestionId &&
        rule.toQuestionId === rule.fromQuestionId
      ) {
        errors.push(`skip[${i}] حلقه مستقیم دارد`);
      }
    });

    const pageGraph = new Map<string, Set<string>>();
    pages.forEach((p, idx) => {
      if (!pageGraph.has(p.id)) pageGraph.set(p.id, new Set());
      if (idx < pages.length - 1) {
        pageGraph.get(p.id)?.add(pages[idx + 1].id);
      }
    });

    const questionToPage = new Map<string, string>();
    pages.forEach((p) =>
      (p.questions ?? []).forEach((q) => questionToPage.set(q.id, p.id)),
    );

    skipRules.forEach((rule) => {
      const fromPage = questionToPage.get(rule.fromQuestionId);
      const toPage =
        rule.toPageId ?? (rule.toQuestionId ? questionToPage.get(rule.toQuestionId) : undefined);
      if (fromPage && toPage) {
        if (!pageGraph.has(fromPage)) pageGraph.set(fromPage, new Set());
        pageGraph.get(fromPage)?.add(toPage);
      }
    });

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

  applyPiping(text: string, answers: Record<string, unknown>, params: Record<string, unknown> = {}) {
    return text.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_, token: string) => {
      if (token.startsWith('param.')) {
        const key = token.slice('param.'.length);
        return String(params[key] ?? '');
      }
      return String(answers[token] ?? '');
    });
  }
}
