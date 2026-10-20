import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PlatformSettingsService } from '../platform/platform-settings.service';
import type { AiProvider } from './ai.types';
import { validateGeneratedForm } from './form-schema.validator';
import { MockAiProvider } from './mock-ai.provider';
import { OpenAiCompatibleProvider } from './openai-compatible.provider';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private readonly platform: PlatformSettingsService) {}

  /**
   * ساخت پرسشنامه با AI.
   * خروجی مدل پیش از بازگشت با schema اعتبارسنجی می‌شود؛ ساختار نامعتبر
   * هرگز به فرم‌ساز نمی‌رسد (بند ۱۰ سند).
   */
  async createSurvey(goal: string, language?: 'fa' | 'en' | 'ar') {
    const { provider, name } = await this.resolveProvider();
    const raw = await provider.createForm({ goal, language });
    const validation = validateGeneratedForm(raw);

    if (!validation.valid) {
      this.logger.warn(`خروجی نامعتبر مدل: ${validation.errors.join(' | ')}`);
      throw new BadRequestException({
        message: 'خروجی هوش مصنوعی با ساختار فرم سازگار نبود',
        errors: validation.errors,
      });
    }

    return { ...validation.normalized, aiProvider: name };
  }

  async reviewSurvey(structure: Record<string, unknown>) {
    const { provider } = await this.resolveProvider();
    return provider.reviewForm({ structure });
  }

  async analyzeAnswers(answers: string[]) {
    const { provider } = await this.resolveProvider();
    return provider.analyzeTextAnswers({ answers });
  }

  async chatWithData(question: string, context?: Record<string, unknown>) {
    const { provider } = await this.resolveProvider();
    return provider.chatWithData({ question, context });
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

  async translateSurvey(
    structure: Record<string, unknown>,
    targetLanguage: 'fa' | 'en' | 'ar',
  ) {
    const { provider } = await this.resolveProvider();
    return provider.translateForm({ structure, targetLanguage });
  }

  /**
   * انتخاب سرویس‌دهنده در هر درخواست.
   *
   * اول از تنظیمات سکو (قابل تغییر از پنل سوپرادمین) خوانده می‌شود؛ اگر آنجا
   * چیزی تنظیم نشده بود، به متغیرهای محیطی برمی‌گردیم و در نهایت به ماک — تا
   * سامانه بدون کلید و بدون اینترنت هم کار کند. خواندنِ هر بار یعنی تغییرِ
   * تنظیمات بدون ری‌استارت اثر می‌کند.
   */
  private async resolveProvider(): Promise<{
    provider: AiProvider;
    name: string;
  }> {
    const config = await this.platform.getAiConfig();

    const provider = (config.provider || 'mock').toLowerCase();
    const envChoice = (process.env.AI_PROVIDER ?? 'mock').toLowerCase();

    // تنظیمات پنل بر محیط اولویت دارد. برای سرویس آنلاین کلید لازم است، ولی
    // مدل محلی (مثل Ollama) کلید نمی‌خواهد؛ در آن حالت نشانی پایه کافی است.
    if (provider === 'openai' && (config.apiKey || config.baseUrl)) {
      return {
        provider: new OpenAiCompatibleProvider(
          config.apiKey || 'local',
          config.baseUrl || undefined,
          config.model || undefined,
        ),
        name: 'openai',
      };
    }

    if (
      provider === 'mock' &&
      envChoice === 'openai' &&
      (process.env.AI_API_KEY || process.env.AI_BASE_URL)
    ) {
      return {
        provider: new OpenAiCompatibleProvider(
          process.env.AI_API_KEY || 'local',
        ),
        name: 'openai',
      };
    }

    return { provider: new MockAiProvider(), name: 'mock' };
  }
}
