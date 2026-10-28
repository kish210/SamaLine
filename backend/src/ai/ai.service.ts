import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PlatformSettingsService } from '../platform/platform-settings.service';
import type { AiProvider } from './ai.types';
import { validateGeneratedForm } from './form-schema.validator';
import { MockAiProvider } from './mock-ai.provider';
import { OpenAiCompatibleProvider } from './openai-compatible.provider';

/** فهرستِ مدل‌ها باید سریع باشد؛ پنل منتظرش می‌ماند. */
const MODEL_LIST_TIMEOUT_MS = 15000;

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

    /*
     * فراتر از نظرسنجی: مدل نوعِ فرم (kind) را می‌گوید و سامانه از روی آن
     * تنظیماتِ امن مشتق می‌کند — نه اینکه settingsِ خامِ مدل را کورکورانه بپذیرد.
     * request → نیازمندِ تأیید؛ checklist → چک‌لیستِ روزانه؛ بقیه بدونِ تنظیمِ خاص.
     * بخش و گردش‌کار را کاربر پس از ساخت در فرم‌ساز تعیین می‌کند (مدل شناسه‌ی
     * واقعیِ بخش‌ها را ندارد)، پس فقط راهنمایی می‌دهیم.
     */
    const kind = normalizeKind((raw as { kind?: unknown }).kind);
    const settings: Record<string, unknown> = {};
    const hints: string[] = [];
    if (kind === 'request') {
      settings.requiresApproval = true;
      hints.push(
        'این فرم نیازمندِ تأیید شد. برای مسیرِ چندمرحله‌ای، در فرم‌ساز «گردش‌کارِ بین‌واحدی» را تنظیم کنید.',
      );
    } else if (kind === 'checklist') {
      settings.checklist = { enabled: true, cadence: 'daily', dueHour: 20 };
      hints.push(
        'این فرم به‌صورت چک‌لیستِ روزانه تنظیم شد. برای هشدارِ انجام‌نشده، در فرم‌ساز بخشِ فرم را مشخص کنید.',
      );
    }
    if (kind !== 'survey') {
      hints.push(
        'برای دسترسیِ واحدی، در فرم‌ساز بخشِ فرم و احرازِ «کارمند» را تنظیم کنید؛ سپس داشبورد/پرتالِ همان بخش گزارش‌ها را نشان می‌دهد.',
      );
    }

    return {
      ...validation.normalized,
      kind,
      settings,
      hints,
      aiProvider: name,
    };
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
   * مدل‌های موجودِ سرویس‌دهنده (برای فهرستِ انتخاب در پنلِ سوپرادمین).
   *
   * از `GET {baseUrl}/models` می‌خواند؛ سرویس‌های سازگار با OpenAI این مسیر
   * را دارند. اگر سرویس‌دهنده ماک باشد، مسیر پشتیبانی نشود یا کلید رد شود،
   * به‌جای خطا فهرستِ خالی با علت برمی‌گردد تا پنل مدل را دستی بگیرد.
   */
  async listModels(): Promise<{
    provider: string;
    models: string[];
    error?: string;
  }> {
    const config = await this.platform.getAiConfig();
    if ((config.provider || 'mock').toLowerCase() !== 'openai') {
      return {
        provider: 'mock',
        models: [],
        error: 'سرویس‌دهنده روی «ماک» است.',
      };
    }

    const baseUrl = (config.baseUrl || 'https://api.openai.com/v1').replace(
      /\/+$/,
      '',
    );
    try {
      const response = await fetch(`${baseUrl}/models`, {
        headers: { authorization: `Bearer ${config.apiKey || 'local'}` },
        signal: AbortSignal.timeout(MODEL_LIST_TIMEOUT_MS),
      });
      if (!response.ok) {
        return {
          provider: 'openai',
          models: [],
          error: `سرویس‌دهنده فهرستِ مدل‌ها را نداد (${response.status}).`,
        };
      }
      /*
       * شکلِ پاسخ بین دروازه‌ها فرق دارد: OpenAI و سازگارها `{data:[{id}]}`،
       * بعضی `{models:[...]}` (مثلِ Ollama با `{name}`) و بعضی آرایه‌ی ساده.
       * هر سه را می‌پذیریم تا APIهای بیشتری فهرستِ مدل بدهند.
       */
      const payload = (await response.json()) as unknown;
      const raw: unknown[] = Array.isArray(payload)
        ? payload
        : Array.isArray((payload as { data?: unknown[] })?.data)
          ? (payload as { data: unknown[] }).data
          : Array.isArray((payload as { models?: unknown[] })?.models)
            ? (payload as { models: unknown[] }).models
            : [];
      const models = raw
        .map((item) =>
          typeof item === 'string'
            ? item
            : ((item as { id?: unknown; name?: unknown })?.id ??
              (item as { name?: unknown })?.name),
        )
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
        .sort((a, b) => a.localeCompare(b));
      return { provider: 'openai', models };
    } catch (error) {
      return {
        provider: 'openai',
        models: [],
        error: `دسترسی به سرویس‌دهنده ممکن نشد: ${(error as Error).message}`,
      };
    }
  }

  /**
   * آزمونِ اتصال: یک درخواستِ کوچکِ واقعی به همان مدلِ تنظیم‌شده.
   *
   * پیش از این درست بودنِ کلید/نشانی/مدل فقط وقتی معلوم می‌شد که کسی فرم
   * می‌ساخت و خطای مبهم می‌گرفت. هرگز throw نمی‌کند؛ نتیجه ok/خطا است.
   */
  async testConnection(): Promise<{
    ok: boolean;
    provider: string;
    model?: string;
    message: string;
  }> {
    const config = await this.platform.getAiConfig();
    const { provider, name } = await this.resolveProvider();
    if (name !== 'openai') {
      return {
        ok: true,
        provider: 'mock',
        message:
          'سرویس‌دهنده روی «ماک» است؛ پاسخ‌ها نمونه‌اند و به اینترنت نیازی نیست.',
      };
    }

    try {
      const result = await provider.chatWithData({
        question: 'فقط برای آزمونِ اتصال، کوتاه سلام کن.',
        context: { ping: true },
      });
      const answer = (result as { answer?: unknown }).answer;
      return {
        ok: true,
        provider: 'openai',
        model: config.model || undefined,
        message:
          typeof answer === 'string' && answer.trim()
            ? `اتصال برقرار است. پاسخِ مدل: ${answer.trim().slice(0, 120)}`
            : 'اتصال برقرار است و مدل پاسخِ معتبر داد.',
      };
    } catch (error) {
      return {
        ok: false,
        provider: 'openai',
        model: config.model || undefined,
        message: (error as Error).message.slice(0, 300),
      };
    }
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

/** نوعِ فرمِ پیشنهادیِ مدل را به یکی از مقدارهای مجاز نگاشت می‌کند. */
function normalizeKind(raw: unknown): 'survey' | 'request' | 'checklist' | 'operational' {
  const k = String(raw ?? '').trim().toLowerCase();
  if (k === 'request' || k === 'checklist' || k === 'operational') return k;
  return 'survey';
}
