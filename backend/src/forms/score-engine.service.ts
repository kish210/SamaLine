import { Injectable } from '@nestjs/common';
import type { FormQuestionNode, FormStructure } from './logic-types';

// نوع‌های ساختار فرم مشترک با موتور منطق است تا دو تعریف واگرا نشوند.
type QuestionLike = FormQuestionNode;

@Injectable()
export class ScoreEngineService {
  calculate(structure: FormStructure, answers: Record<string, unknown>) {
    const indexes = structure.scoreIndexes ?? [];
    const questions = (structure.pages ?? []).flatMap((p) => p.questions ?? []);

    const buckets = new Map<
      string,
      {
        values: number[];
        weightedSum: number;
        weightSum: number;
        maxPossible: number;
      }
    >();

    for (const idx of indexes) {
      buckets.set(idx.id, {
        values: [],
        weightedSum: 0,
        weightSum: 0,
        maxPossible: idx.maxScore ?? 100,
      });
    }

    // عضویت سوال در شاخص می‌تواند از سمت شاخص هم اعلام شده باشد.
    const membership = new Map<string, string>();
    for (const idx of indexes) {
      for (const qid of idx.questionIds ?? []) membership.set(qid, idx.id);
    }

    for (const q of questions) {
      const indexId = q.scoring?.indexId ?? membership.get(q.id);
      if (!indexId || !buckets.has(indexId)) continue;
      const raw = answers[q.id];
      const numericValue = this.resolveNumericValue(raw, q);
      if (numericValue === null) continue;

      const weight = q.scoring?.weight ?? q.weight ?? 1;
      const bucket = buckets.get(indexId);
      if (!bucket) continue;
      bucket.values.push(numericValue);
      bucket.weightedSum += numericValue * weight;
      bucket.weightSum += weight;
      bucket.maxPossible = Math.max(bucket.maxPossible, weight * 100);
    }

    const output: Record<string, number> = {};
    for (const idx of indexes) {
      const bucket = buckets.get(idx.id);
      if (!bucket) continue;
      const method = idx.method ?? 'sum';
      let score = 0;
      if (method === 'avg') {
        score = bucket.values.length
          ? bucket.values.reduce((a, b) => a + b, 0) / bucket.values.length
          : 0;
      } else if (method === 'weighted') {
        score = bucket.weightSum ? bucket.weightedSum / bucket.weightSum : 0;
      } else if (method === 'percent') {
        const sum = bucket.values.reduce((a, b) => a + b, 0);
        const denominator = idx.maxScore ?? bucket.values.length * 100;
        score = denominator ? (sum / denominator) * 100 : 0;
      } else {
        score = bucket.values.reduce((a, b) => a + b, 0);
      }
      output[idx.key] = Number(score.toFixed(2));
    }

    return output;
  }

  private resolveNumericValue(
    raw: unknown,
    question: QuestionLike,
  ): number | null {
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    if (typeof raw === 'boolean') return raw ? 1 : 0;
    if (typeof raw === 'string') {
      const asNumber = Number(raw);
      if (!Number.isNaN(asNumber) && Number.isFinite(asNumber)) return asNumber;
      const weightedChoice = question.choices?.find((c) => c.id === raw);
      if (weightedChoice) return weightedChoice.weight ?? 0;
      return null;
    }
    if (Array.isArray(raw)) {
      const numericValues = raw
        .map((item) => this.resolveNumericValue(item, question))
        .filter((v): v is number => v !== null);
      if (!numericValues.length) return null;
      return numericValues.reduce((a, b) => a + b, 0);
    }
    return null;
  }
}
