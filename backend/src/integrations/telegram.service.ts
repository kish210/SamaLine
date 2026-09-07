import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TelegramIntegrationEntity } from '../database/entities/telegram-integration.entity';
import type { FormQuestionNode, FormStructure } from '../forms/logic-types';

const TELEGRAM_API = 'https://api.telegram.org';

/** حداکثر طول پیام تلگرام؛ پیام بلندتر با خطا رد می‌شود، نه اینکه بریده شود. */
const MAX_MESSAGE = 4096;

export interface TelegramSettingsInput {
  botToken?: string;
  chatId?: string;
  isActive?: boolean;
  notifyOnResponse?: boolean;
  scoreThreshold?: number | null;
}

/**
 * اطلاع‌رسانی پاسخ‌های تازه در تلگرام.
 *
 * ارسال عمداً «بی‌صدا» شکست می‌خورد: اگر تلگرام در دسترس نباشد یا توکن غلط
 * باشد، پاسخ پاسخ‌دهنده نباید رد شود. خطا در همان ردیف تنظیمات ذخیره می‌شود
 * تا در پنل دیده شود.
 */
@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    @InjectRepository(TelegramIntegrationEntity)
    private readonly repo: Repository<TelegramIntegrationEntity>,
  ) {}

  /** تنظیمات برای نمایش در پنل؛ توکن هرگز برنمی‌گردد. */
  async getSettings(workspaceId: string) {
    const row = await this.repo.findOne({ where: { workspaceId } });
    if (!row) {
      return {
        configured: false,
        isActive: false,
        notifyOnResponse: true,
        chatId: '',
        scoreThreshold: null as number | null,
        lastError: null as string | null,
        lastSentAt: null as Date | null,
      };
    }
    return {
      configured: true,
      isActive: row.isActive,
      notifyOnResponse: row.notifyOnResponse,
      chatId: row.chatId,
      scoreThreshold: row.scoreThreshold,
      lastError: row.lastError,
      lastSentAt: row.lastSentAt,
    };
  }

  async saveSettings(workspaceId: string, input: TelegramSettingsInput) {
    const existing = await this.repo.findOne({ where: { workspaceId } });

    if (!existing && !input.botToken) {
      throw new BadRequestException('برای اتصال، توکن ربات لازم است');
    }
    if (!existing && !input.chatId) {
      throw new BadRequestException('شناسه‌ی گفتگو (chat id) لازم است');
    }

    const row = this.repo.create({
      ...existing,
      workspaceId,
      // توکن خالی یعنی «دست نزن»، نه «پاک کن»؛ پنل توکن ذخیره‌شده را
      // نمی‌بیند و اگر خالی بودن را پاک‌کردن حساب کنیم، هر بار ذخیره‌ی
      // تنظیمات اتصال را از کار می‌اندازد.
      botToken: input.botToken?.trim() || existing?.botToken || '',
      chatId: input.chatId?.trim() || existing?.chatId || '',
      isActive: input.isActive ?? existing?.isActive ?? true,
      notifyOnResponse:
        input.notifyOnResponse ?? existing?.notifyOnResponse ?? true,
      scoreThreshold:
        input.scoreThreshold === undefined
          ? (existing?.scoreThreshold ?? null)
          : input.scoreThreshold,
    });

    await this.repo.save(row);
    return this.getSettings(workspaceId);
  }

  async remove(workspaceId: string) {
    await this.repo.delete({ workspaceId });
    return { ok: true };
  }

  /** ارسال پیام آزمایشی؛ برخلاف ارسال خودکار، خطا را به کاربر برمی‌گرداند. */
  async sendTest(workspaceId: string) {
    const row = await this.repo.findOne({ where: { workspaceId } });
    if (!row) throw new BadRequestException('ابتدا اتصال را تنظیم کنید');

    const result = await this.send(
      row,
      '✅ اتصال SamaLine به این گفتگو برقرار است.',
    );
    if (!result.ok) {
      throw new BadRequestException(`ارسال ناموفق: ${result.error}`);
    }
    return { ok: true };
  }

  /**
   * اطلاع‌رسانی یک پاسخ تازه.
   *
   * هرگز throw نمی‌کند: این از داخل مسیر ثبت پاسخ صدا زده می‌شود و خطای
   * تلگرام نباید پاسخ پاسخ‌دهنده را از بین ببرد.
   */
  async notifyResponse(input: {
    workspaceId: string;
    formTitle: string;
    structure: FormStructure;
    answers: Record<string, unknown>;
    scores: Record<string, number>;
  }): Promise<void> {
    try {
      const row = await this.repo.findOne({
        where: { workspaceId: input.workspaceId },
      });
      if (!row || !row.isActive || !row.notifyOnResponse) return;

      if (row.scoreThreshold !== null) {
        const values = Object.values(input.scores);
        // بدون امتیاز نمی‌شود درباره‌ی آستانه قضاوت کرد؛ چنین پاسخی
        // فرستاده می‌شود تا از قلم نیفتد.
        if (values.length > 0 && Math.min(...values) >= row.scoreThreshold) {
          return;
        }
      }

      const result = await this.send(row, this.buildMessage(input));
      await this.repo.update(
        { id: row.id },
        result.ok
          ? { lastSentAt: new Date(), lastError: null }
          : { lastError: result.error.slice(0, 300) },
      );
    } catch (error) {
      this.logger.warn(
        `اطلاع‌رسانی تلگرام انجام نشد: ${(error as Error).message}`,
      );
    }
  }

  /** متن پیام پاسخ؛ HTML تلگرام، با گریز کاراکترهای خاص. */
  private buildMessage(input: {
    formTitle: string;
    structure: FormStructure;
    answers: Record<string, unknown>;
    scores: Record<string, number>;
  }): string {
    const questions = (input.structure.pages ?? []).flatMap(
      (page) => page.questions ?? [],
    );
    const lines = [`📝 <b>${escapeHtml(input.formTitle)}</b>`, ''];

    for (const question of questions) {
      const value = input.answers[question.id];
      if (value === undefined || value === null || value === '') continue;
      lines.push(
        `<b>${escapeHtml(title(question))}:</b> ${escapeHtml(
          formatValue(value),
        )}`,
      );
    }

    const scores = Object.entries(input.scores);
    if (scores.length > 0) {
      lines.push('');
      for (const [key, value] of scores) {
        lines.push(`📊 <b>${escapeHtml(key)}:</b> ${value}`);
      }
    }

    const message = lines.join('\n');
    if (message.length <= MAX_MESSAGE) return message;
    // پیام‌های خیلی بلند را تلگرام رد می‌کند؛ بریدن بهتر از نفرستادن است.
    return `${message.slice(0, MAX_MESSAGE - 40)}\n\n… (ادامه در پنل)`;
  }

  private async send(
    row: TelegramIntegrationEntity,
    text: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
      const response = await fetch(
        `${TELEGRAM_API}/bot${row.botToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            chat_id: row.chatId,
            text,
            parse_mode: 'HTML',
            disable_web_page_preview: true,
          }),
          // بدون مهلت، یک تلگرام کند مسیر ثبت پاسخ را نگه می‌دارد.
          signal: AbortSignal.timeout(8000),
        },
      );

      const body = (await response.json()) as {
        ok?: boolean;
        description?: string;
      };
      if (!response.ok || !body.ok) {
        return {
          ok: false,
          error: body.description ?? `پاسخ ${response.status}`,
        };
      }
      return { ok: true };
    } catch (error) {
      return { ok: false, error: (error as Error).message };
    }
  }
}

function title(question: FormQuestionNode): string {
  return question.title ?? question.id;
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.map((v) => String(v)).join('، ');
  if (typeof value === 'boolean') return value ? 'بله' : 'خیر';
  if (value !== null && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${String(v)}`)
      .join('، ');
  }
  const text = String(value);
  // پاسخ‌های خیلی بلند (مثل فایل به شکل data URL) پیام را بی‌فایده می‌کنند.
  return text.length > 300 ? `${text.slice(0, 300)}…` : text;
}

/** گریز کاراکترهایی که تلگرام در حالت HTML به‌عنوان تگ می‌خواند. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
