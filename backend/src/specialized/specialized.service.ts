import { Injectable } from '@nestjs/common';

type QuizQuestion = {
  id: string;
  type?: string;
  meta?: {
    correctAnswer?: unknown;
    score?: number;
  };
};

@Injectable()
export class SpecializedService {
  gradeQuiz(
    structure: Record<string, unknown>,
    answers: Record<string, unknown>,
  ) {
    const pages = Array.isArray(structure.pages) ? structure.pages : [];
    const questions = pages.flatMap((p) => {
      const pp = p as { questions?: QuizQuestion[] };
      return Array.isArray(pp.questions) ? pp.questions : [];
    });

    let total = 0;
    let max = 0;
    const details = questions.map((question) => {
      const correct = question.meta?.correctAnswer;
      const point = Number(question.meta?.score ?? 1);
      const given = answers[question.id];
      const passed = JSON.stringify(given) === JSON.stringify(correct);
      max += point;
      if (passed) total += point;
      return {
        questionId: question.id,
        given,
        correct,
        passed,
        score: passed ? point : 0,
        maxScore: point,
      };
    });

    return {
      totalScore: total,
      maxScore: max,
      percent: max > 0 ? Number(((total / max) * 100).toFixed(2)) : 0,
      details,
    };
  }

  aggregate360(
    evaluations: Array<{ role: string; scores: Record<string, number> }>,
  ) {
    const roleBuckets = new Map<string, Record<string, number[]>>();

    evaluations.forEach((item) => {
      if (!roleBuckets.has(item.role)) roleBuckets.set(item.role, {});
      const metrics = roleBuckets.get(item.role) as Record<string, number[]>;
      Object.entries(item.scores ?? {}).forEach(([key, value]) => {
        if (!Number.isFinite(value)) return;
        metrics[key] ??= [];
        metrics[key].push(value);
      });
    });

    const byRole = Array.from(roleBuckets.entries()).map(([role, metrics]) => {
      const averageScores = Object.fromEntries(
        Object.entries(metrics).map(([key, values]) => [
          key,
          values.length
            ? Number(
                (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2),
              )
            : 0,
        ]),
      );
      return { role, averageScores };
    });

    const overall: Record<string, number[]> = {};
    byRole.forEach((roleData) => {
      Object.entries(roleData.averageScores).forEach(([metric, value]) => {
        overall[metric] ??= [];
        overall[metric].push(value);
      });
    });

    const overallAverage = Object.fromEntries(
      Object.entries(overall).map(([metric, values]) => [
        metric,
        values.length
          ? Number(
              (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2),
            )
          : 0,
      ]),
    );

    return {
      roles: byRole,
      overallAverage,
      spiderChart: byRole,
    };
  }

  calculateExperienceMetric(
    type: 'nps' | 'csat' | 'ces' | 'enps',
    scores: number[],
  ) {
    const clean = scores.filter((s) => Number.isFinite(s));
    if (!clean.length) return { type, value: 0, sampleSize: 0 };

    if (type === 'nps' || type === 'enps') {
      const promoters = clean.filter((s) => s >= 9).length;
      const detractors = clean.filter((s) => s <= 6).length;
      const value = Number(
        (((promoters - detractors) / clean.length) * 100).toFixed(2),
      );
      return { type, value, promoters, detractors, sampleSize: clean.length };
    }

    if (type === 'csat') {
      const satisfied = clean.filter((s) => s >= 4).length;
      const value = Number(((satisfied / clean.length) * 100).toFixed(2));
      return { type, value, satisfied, sampleSize: clean.length };
    }

    const avg = Number(
      (clean.reduce((a, b) => a + b, 0) / clean.length).toFixed(2),
    );
    return { type, value: avg, sampleSize: clean.length };
  }

  listTemplates(category?: 'mbti' | 'herzberg' | 'cx' | 'hr') {
    const templates = [
      {
        id: 'tpl_mbti_quick',
        category: 'mbti',
        title: 'MBTI کوتاه',
        questionCount: 32,
      },
      {
        id: 'tpl_herzberg_job',
        category: 'herzberg',
        title: 'رضایت شغلی هرزبرگ',
        questionCount: 24,
      },
      {
        id: 'tpl_cx_journey',
        category: 'cx',
        title: 'تجربه مشتری سفر خرید',
        questionCount: 18,
      },
      {
        id: 'tpl_hr_360_basic',
        category: 'hr',
        title: 'ارزیابی ۳۶۰ پایه',
        questionCount: 40,
      },
    ] as const;

    if (!category) return templates;
    return templates.filter((item) => item.category === category);
  }
}
