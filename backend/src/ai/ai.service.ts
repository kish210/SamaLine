import { Injectable } from '@nestjs/common';
import { MockAiProvider } from './mock-ai.provider';

@Injectable()
export class AiService {
  private readonly provider = new MockAiProvider();

  createSurvey(goal: string, language?: 'fa' | 'en' | 'ar') {
    return this.provider.createForm({ goal, language });
  }

  reviewSurvey(structure: Record<string, unknown>) {
    return this.provider.reviewForm({ structure });
  }

  analyzeAnswers(answers: string[]) {
    return this.provider.analyzeTextAnswers({ answers });
  }

  chatWithData(question: string, context?: Record<string, unknown>) {
    return this.provider.chatWithData({ question, context });
  }

  summarizeMetrics(metrics: Record<string, number>) {
    const entries = Object.entries(metrics);
    const sorted = entries.sort((a, b) => b[1] - a[1]);
    return {
      topMetric: sorted[0] ?? null,
      lowMetric: sorted[sorted.length - 1] ?? null,
      count: sorted.length,
      recommendation:
        sorted.length > 0
          ? `بهبود شاخص ${sorted[sorted.length - 1][0]} در اولویت باشد.`
          : 'داده‌ای برای تحلیل وجود ندارد.',
    };
  }

  translateSurvey(
    structure: Record<string, unknown>,
    targetLanguage: 'fa' | 'en' | 'ar',
  ) {
    return this.provider.translateForm({ structure, targetLanguage });
  }
}
