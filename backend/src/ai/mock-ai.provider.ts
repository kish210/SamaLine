import { AiCreateFormInput, AiProvider, AiReviewInput } from './ai.types';

export class MockAiProvider implements AiProvider {
  createForm(input: AiCreateFormInput) {
    return Promise.resolve({
      title: input.goal,
      language: input.language ?? 'fa',
      pages: [
        {
          id: 'page_1',
          questions: [
            {
              id: 'q_1',
              type: 'short_text',
              title: 'مهم‌ترین انتظار شما چیست؟',
              required: true,
            },
            {
              id: 'q_2',
              type: 'rating',
              title: 'رضایت کلی شما از ۱ تا ۵ چقدر است؟',
              required: true,
            },
          ],
        },
      ],
      aiMeta: { provider: 'mock', schemaValidated: true },
    });
  }

  reviewForm(input: AiReviewInput) {
    return Promise.resolve({
      findings: [
        'در ابتدای فرم یک سوال جمعیت‌شناختی کوتاه اضافه شود.',
        'برای سوالات طولانی گزینه «سایر» و سوال تشریحی تکمیلی در نظر بگیرید.',
      ],
      inputSize: JSON.stringify(input.structure).length,
      schemaValidated: true,
    });
  }

  analyzeTextAnswers(input: { answers: string[] }) {
    return Promise.resolve({
      sentiment: {
        positive: input.answers.filter((text) => /خوب|عالی|راضی/.test(text))
          .length,
        neutral: input.answers.filter(
          (text) => !/خوب|عالی|راضی|بد|ناراضی/.test(text),
        ).length,
        negative: input.answers.filter((text) => /بد|ناراضی/.test(text)).length,
      },
      topics: ['کیفیت خدمت', 'زمان پاسخگویی', 'رفتار کارکنان'],
    });
  }

  chatWithData(input: { question: string; context?: Record<string, unknown> }) {
    return Promise.resolve({
      question: input.question,
      answer:
        'بر اساس داده‌های فعلی، شعبه تهران کمترین رضایت را داشته است (خروجی نمونه).',
      queryPlan: {
        filters: input.context ?? {},
        metric: 'avg_satisfaction',
        grouping: 'branch',
      },
      safeMode: true,
    });
  }

  translateForm(input: {
    structure: Record<string, unknown>;
    targetLanguage: 'fa' | 'en' | 'ar';
  }) {
    return Promise.resolve({
      targetLanguage: input.targetLanguage,
      translatedStructure: input.structure,
      note: 'ترجمه در حالت mock انجام شده و ساختار اصلی حفظ شده است.',
    });
  }
}
