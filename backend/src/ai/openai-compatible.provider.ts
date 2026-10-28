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
        '"questions":[{"id":string,"type":string,"title":string,"required":boolean,"options":string[]}]}]}\n' +
        'type فقط یکی از این‌ها: short_text, long_text, multiple_choice, dropdown, boolean, rating, nps, number, date, email, mobile. ' +
        'برای سوالِ گزینه‌ای options را پر کن.',
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
    const messages = [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ];

    try {
      let response = await this.post({
        model: this.model,
        messages,
        response_format: { type: 'json_object' },
      });

      /*
       * همه‌ی مدل‌ها/دروازه‌ها حالتِ JSON را نمی‌پذیرند (مثلا برخی مدل‌های
       * DeepSeek پشتِ دروازه‌های سازگار با OpenAI). رد شدنش با ۴۰۰ نباید کل
       * قابلیت را بشکند: یک بار بدونِ آن تکرار می‌کنیم؛ دستورِ «فقط JSON»
       * در پیامِ سیستم هست و پاسخ در extractJson پاک‌سازی می‌شود.
       */
      if (response.status === 400) {
        const text = await response.text();
        if (/response_format|json_object|json mode/i.test(text)) {
          this.logger.warn('مدل response_format را نپذیرفت؛ تکرار بدونِ آن');
          response = await this.post({ model: this.model, messages });
        } else {
          throw new Error(
            `خطای سرویس هوش مصنوعی (400): ${text.slice(0, 300)}`,
          );
        }
      }

      if (!response.ok) {
        const text = await response.text();
        throw new Error(
          `خطای سرویس هوش مصنوعی (${response.status}): ${text.slice(0, 300)}`,
        );
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      return extractJson(payload.choices?.[0]?.message?.content ?? '{}');
    } catch (error) {
      this.logger.error(
        error instanceof Error ? error.message : 'خطای نامشخص هوش مصنوعی',
      );
      throw error;
    }
  }

  private async post(body: Record<string, unknown>): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      // اسلشِ انتهاییِ نشانیِ پایه (رایج در تنظیمِ دستی) دو تا نشود.
      return await fetch(`${this.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * JSON را از پاسخِ مدل بیرون می‌کشد.
 *
 * مدل‌ها همیشه JSONِ خالص برنمی‌گردانند: مدل‌های استدلالی (مثل DeepSeek R1)
 * پیش از جواب ‎<think>…</think>‎ می‌نویسند، بعضی جواب را در حصارِ ‎```json‎
 * می‌پیچند و بعضی یک جمله پیش یا پس از آن می‌گذارند. به‌ترتیب: پارسِ مستقیم،
 * حذفِ بلوکِ think و حصار، و در آخر برشِ اولین «{» تا آخرین «}».
 */
export function extractJson(content: string): Record<string, unknown> {
  const tryParse = (text: string): Record<string, unknown> | null => {
    try {
      const value: unknown = JSON.parse(text);
      return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  };

  const direct = tryParse(content.trim());
  if (direct) return direct;

  const cleaned = content
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```(?:json)?/gi, '')
    .trim();
  const fromCleaned = tryParse(cleaned);
  if (fromCleaned) return fromCleaned;

  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first !== -1 && last > first) {
    const sliced = tryParse(cleaned.slice(first, last + 1));
    if (sliced) return sliced;
  }
  throw new Error('خروجیِ مدل JSONِ معتبر نبود؛ مدلِ دیگری را امتحان کنید.');
}
