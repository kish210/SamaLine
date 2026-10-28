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
      [
        'تو طراحِ حرفه‌ایِ فرم و نظرسنجیِ سامانه‌ی «سَماع» هستی (ویژه‌ی هتل و کسب‌وکار).',
        'کاربر معمولاً فقط یک جمله‌ی کوتاه می‌نویسد؛ کارِ تو این است که از همان جمله',
        'صنف/شغل/صنعتِ مرتبط را تشخیص دهی و فرمی استاندارد و حرفه‌ایِ همان حوزه بسازی —',
        'نه چند سوالِ عمومی. مثال: «رضایت مهمان هتل» → پذیرش، نظافتِ اتاق، رستوران،',
        'برخوردِ کارکنان، نسبتِ ارزش به قیمت، احتمالِ توصیه (NPS)؛ «سفارش کافه» → اقلام،',
        'کیفیت، سرعتِ سرو، قیمت؛ «استخدام» → سوابق، مهارت، حقوقِ درخواستی.',
        'سوال‌ها و شاخص‌های متعارفِ همان صنف را بیاور تا خروجی برای متخصصِ آن حوزه هم حرفه‌ای باشد.',
        'قواعد: عنوان‌ها کوتاه و بدونِ سوگیری یا هدایت‌کنندگی؛ ترتیبِ منطقی و هم‌موضوع در یک صفحه؛',
        'معمولاً ۵ تا ۱۲ سوال؛ نوعِ هر سوال مناسبِ همان پرسش (نه همه short_text)؛',
        'سوالِ هویتی/تماس فقط اگر لازم است و required منطقی.',
        'خروجی باید عیناً در سَماع قابلِ‌استفاده باشد: فقط JSON معتبر و مطابقِ قالب؛ بدونِ توضیح، بدونِ ```.',
      ].join(' '),
      `هدفِ کاربر (متنِ خودش): «${input.goal}»\n` +
        `زبانِ خروجی: ${input.language ?? 'fa'} (همه‌ی متن‌ها به همین زبان).\n` +
        'قالبِ خروجی دقیقاً: {"title":string,"language":string,"pages":[{"id":string,"title":string,' +
        '"questions":[{"id":string,"type":string,"title":string,"required":boolean,"options":string[]}]}]}\n' +
        'type فقط یکی از: short_text, long_text, multiple_choice, dropdown, boolean, rating, nps, slider, number, date, email, mobile, phone.\n' +
        'برای multiple_choice/dropdown، options را با گزینه‌های واقعی و جامع پر کن (برای بقیه options را [] بگذار).\n' +
        'id هر سوال و صفحه را کوتاه و یکتا و لاتین بگذار (مثل q1, q2, p1).',
    );
  }

  reviewForm(input: AiReviewInput) {
    return this.completeJson(
      [
        'تو ممیزِ کیفیتِ فرم و نظرسنجی هستی.',
        'هر سوال را از نظرِ سوگیری، ابهام، هدایت‌کنندگی، گزینه‌های ناقص/هم‌پوشان،',
        'و سوالِ تکراری یا زائد بررسی کن. برای هر ایراد یک اصلاحِ مشخص و عملی بده.',
        'اگر فرم خوب است، issues را خالی برگردان. فقط JSON برگردان؛ بدونِ توضیح، بدونِ ```.',
      ].join(' '),
      `این ساختارِ فرم را بازنگری کن:\n${JSON.stringify(input.structure)}\n` +
        'قالبِ خروجی دقیقاً: {"issues":[{"questionId":string,"kind":string,"message":string,"suggestion":string}]}\n' +
        'kind یکی از: bias, ambiguity, leading, options, redundant, other. پیام و پیشنهاد به فارسیِ روان.',
    );
  }

  analyzeTextAnswers(input: { answers: string[] }) {
    return this.completeJson(
      [
        'تو تحلیلگرِ پاسخ‌های بازِ نظرسنجیِ فارسی هستی.',
        'لحن (مثبت/خنثی/منفی) را بر پایه‌ی معنای واقعی بسنج (نه فقط کلمات)،',
        'موضوع‌های پرتکرار را دسته‌بندی کن و شمارشِ تقریبی بده،',
        'و یک خلاصه‌ی کوتاه و کاربردی برای مدیر بنویس. فقط JSON برگردان؛ بدونِ ```.',
      ].join(' '),
      `پاسخ‌های متن‌باز:\n${JSON.stringify(input.answers)}\n` +
        'قالبِ خروجی دقیقاً: {"sentiment":{"positive":number,"neutral":number,"negative":number},' +
        '"topics":[{"label":string,"count":number}],"summary":string}\n' +
        'عددهای sentiment تعدادِ پاسخ‌اند و جمعشان با کلِ پاسخ‌ها بخواند. label و summary فارسی.',
    );
  }

  chatWithData(input: { question: string; context?: Record<string, unknown> }) {
    return this.completeJson(
      [
        'تو دستیارِ تحلیلِ داده‌ی سَماع هستی.',
        'فقط و فقط بر پایه‌ی «داده»ی داده‌شده پاسخ بده؛ چیزی از خودت نساز.',
        'اگر داده برای پاسخ کافی نیست، صادقانه بگو که داده کافی نیست.',
        'پاسخ کوتاه، دقیق و فارسی. فقط JSON برگردان؛ بدونِ ```.',
      ].join(' '),
      `پرسشِ کاربر: «${input.question}»\nداده:\n${JSON.stringify(input.context ?? {})}\n` +
        'قالبِ خروجی دقیقاً: {"answer":string,"basis":string[]}\n' +
        'basis فهرستِ کوتاهی از همان بخش‌هایی از داده است که پاسخ بر آن‌ها استوار است.',
    );
  }

  translateForm(input: {
    structure: Record<string, unknown>;
    targetLanguage: 'fa' | 'en' | 'ar';
  }) {
    return this.completeJson(
      [
        'تو مترجمِ حرفه‌ایِ فرم هستی.',
        'فقط متنِ دیده‌شده توسطِ کاربر (title، options، توضیح‌ها) را ترجمه کن؛',
        'ساختار و کلیدها و id‌ها و type‌ها را عیناً دست‌نخورده نگه دار.',
        'ترجمه روان و بومی باشد، نه تحت‌اللفظی. فقط JSON با همان ساختار برگردان؛ بدونِ ```.',
      ].join(' '),
      `زبانِ مقصد: ${input.targetLanguage}\nساختارِ فرم:\n${JSON.stringify(input.structure)}`,
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
