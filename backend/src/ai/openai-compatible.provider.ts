import { Logger } from '@nestjs/common';
import { AiCreateFormInput, AiProvider, AiReviewInput } from './ai.types';

/**
 * سرویس‌دهنده‌ی سازگار با OpenAI (شامل مدل‌های داخلی و سرورهای خودمیزبان).
 *
 * با `AI_PROVIDER=openai` و `AI_API_KEY` فعال می‌شود؛ `AI_BASE_URL` را
 * می‌توان به هر سرویس سازگار (از جمله مدل داخل سازمان) اشاره داد.
 * تا وقتی تنظیم نشود، سامانه با سرویس‌دهنده‌ی ماک کار می‌کند و به
 * اینترنت نیاز ندارد.
 */
export class OpenAiCompatibleProvider implements AiProvider {
  private readonly logger = new Logger(OpenAiCompatibleProvider.name);

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = process.env.AI_BASE_URL ??
      'https://api.openai.com/v1',
    private readonly model = process.env.AI_MODEL ?? 'gpt-4o-mini',
    private readonly timeoutMs = Number(process.env.AI_TIMEOUT_MS ?? 60000),
  ) {}

  createForm(input: AiCreateFormInput) {
    return this.completeJson(
      'تو یک طراح پرسشنامه‌ی حرفه‌ای فارسی هستی. فقط JSON معتبر برگردان.',
      `یک پرسشنامه برای این هدف بساز: ${input.goal}\n` +
        `زبان: ${input.language ?? 'fa'}\n` +
        'قالب خروجی: {"title":string,"language":string,"pages":[{"id":string,"title":string,' +
        '"questions":[{"id":string,"type":string,"title":string,"required":boolean,"options":string[]}]}]}',
    );
  }

  reviewForm(input: AiReviewInput) {
    return this.completeJson(
      'تو یک ممیز پرسشنامه هستی. سوگیری، ابهام و سوال هدایت‌کننده را پیدا کن. فقط JSON برگردان.',
      `این ساختار را بازنگری کن: ${JSON.stringify(input.structure)}\n` +
        'قالب خروجی: {"issues":[{"questionId":string,"kind":string,"message":string,"suggestion":string}]}',
    );
  }

  analyzeTextAnswers(input: { answers: string[] }) {
    return this.completeJson(
      'تو یک تحلیلگر داده‌ی نظرسنجی فارسی هستی. فقط JSON برگردان.',
      `این پاسخ‌های متن باز را تحلیل کن: ${JSON.stringify(input.answers)}\n` +
        'قالب خروجی: {"sentiment":{"positive":number,"neutral":number,"negative":number},' +
        '"topics":[{"label":string,"count":number}],"summary":string}',
    );
  }

  chatWithData(input: { question: string; context?: Record<string, unknown> }) {
    return this.completeJson(
      'به پرسش کاربر فقط بر اساس داده‌ی داده‌شده پاسخ بده. فقط JSON برگردان.',
      `پرسش: ${input.question}\nداده: ${JSON.stringify(input.context ?? {})}\n` +
        'قالب خروجی: {"answer":string,"basis":string[]}',
    );
  }

  translateForm(input: {
    structure: Record<string, unknown>;
    targetLanguage: 'fa' | 'en' | 'ar';
  }) {
    return this.completeJson(
      'تو یک مترجم پرسشنامه هستی. ساختار را دست‌نخورده نگه دار و فقط متن‌ها را ترجمه کن. فقط JSON برگردان.',
      `به زبان ${input.targetLanguage} ترجمه کن: ${JSON.stringify(input.structure)}`,
    );
  }

  private async completeJson(
    system: string,
    user: string,
  ): Promise<Record<string, unknown>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(
          `خطای سرویس هوش مصنوعی (${response.status}): ${text.slice(0, 300)}`,
        );
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = payload.choices?.[0]?.message?.content ?? '{}';
      return JSON.parse(content) as Record<string, unknown>;
    } catch (error) {
      this.logger.error(
        error instanceof Error ? error.message : 'خطای نامشخص هوش مصنوعی',
      );
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}
