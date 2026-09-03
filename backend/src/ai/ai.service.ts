import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { AiProvider } from './ai.types';
import { validateGeneratedForm } from './form-schema.validator';
import { MockAiProvider } from './mock-ai.provider';
import { OpenAiCompatibleProvider } from './openai-compatible.provider';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly provider: AiProvider = AiService.resolveProvider();

  /** نام سرویس‌دهنده‌ی فعال — برای نمایش در پنل. */
  get providerName() {
    return this.provider instanceof MockAiProvider ? 'mock' : 'openai';
  }

  /**
   * ساخت پرسشنامه با AI.
   * خروجی مدل پیش از بازگشت با schema اعتبارسنجی می‌شود؛ ساختار نامعتبر
   * هرگز به فرم‌ساز نمی‌رسد (بند ۱۰ سند).
   */
  async createSurvey(goal: string, language?: 'fa' | 'en' | 'ar') {
    const raw = await this.provider.createForm({ goal, language });
    const validation = validateGeneratedForm(raw);

    if (!validation.valid) {
      this.logger.warn(`خروجی نامعتبر مدل: ${validation.errors.join(' | ')}`);
      throw new BadRequestException({
        message: 'خروجی هوش مصنوعی با ساختار فرم سازگار نبود',
        errors: validation.errors,
      });
    }

    return { ...validation.normalized, aiProvider: this.providerName };
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

  /**
   * انتخاب سرویس‌دهنده از متغیر محیطی.
   * پیش‌فرض ماک است تا سامانه بدون کلید و بدون اینترنت کار کند.
   */
  private static resolveProvider(): AiProvider {
    const choice = (process.env.AI_PROVIDER ?? 'mock').toLowerCase();
    const apiKey = process.env.AI_API_KEY;

    if (choice === 'openai' && apiKey) {
      return new OpenAiCompatibleProvider(apiKey);
    }

    return new MockAiProvider();
  }
}
