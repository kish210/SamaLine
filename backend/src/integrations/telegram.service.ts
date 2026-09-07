import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { TelegramIntegrationEntity } from '../database/entities/telegram-integration.entity';
import { TelegramRecipientEntity } from '../database/entities/telegram-recipient.entity';
import type { FormQuestionNode, FormStructure } from '../forms/logic-types';

const TELEGRAM_API = 'https://api.telegram.org';

/** حداکثر طول پیام تلگرام؛ پیام بلندتر رد می‌شود، پس بریده می‌شود. */
const MAX_MESSAGE = 4096;

export interface TelegramBotInput {
  botToken?: string;
  isActive?: boolean;
}

export interface TelegramRecipientInput {
  formId?: string | null;
  chatId: string;
  label?: string;
  scoreThreshold?: number | null;
  isActive?: boolean;
}

/**
 * اطلاع‌رسانی پاسخ‌های تازه در تلگرام.
 *
 * دو لایه دارد: یک ربات برای هر فضای کاری، و چند «مقصد» که هرکدام می‌گویند
 * پاسخ‌های کدام فرم به کدام گفتگو برود. این تفکیک لازم است چون مدیر هتل
 * باید فقط پاسخ فرم خودش را بگیرد، نه همه‌ی فرم‌های سازمان.
 *
 * ارسال عمداً بی‌صدا شکست می‌خورد: اگر تلگرام در دسترس نباشد، پاسخ
 * پاسخ‌دهنده نباید رد شود. خطا روی همان مقصد ذخیره می‌شود تا در پنل دیده شود.
 */
@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(
    @InjectRepository(TelegramIntegrationEntity)
    private readonly repo: Repository<TelegramIntegrationEntity>,
    @InjectRepository(TelegramRecipientEntity)
    private readonly recipientRepo: Repository<TelegramRecipientEntity>,
  ) {}

  // ── ربات ──────────────────────────────────────────────────────────────

  /** وضعیت ربات؛ توکن هرگز برنمی‌گردد. */
  async getBot(workspaceId: string) {
    const row = await this.repo.findOne({ where: { workspaceId } });
    return {
      configured: Boolean(row?.botToken),
      isActive: row?.isActive ?? false,
      botUsername: row?.botUsername ?? null,
      lastError: row?.lastError ?? null,
      lastSentAt: row?.lastSentAt ?? null,
    };
  }

  /**
   * ذخیره‌ی توکن ربات.
   *
   * توکن پیش از ذخیره با getMe آزموده می‌شود؛ توکن غلط باید همان‌جا خطا
   * بدهد، نه اینکه ماه‌ها بعد با نرسیدن اولین پیام کشف شود.
   */
  async saveBot(workspaceId: string, input: TelegramBotInput) {
    const existing = await this.repo.findOne({ where: { workspaceId } });
    const token = input.botToken?.trim() || existing?.botToken;
    if (!token) throw new BadRequestException('توکن ربات لازم است');

    let botUsername = existing?.botUsername ?? null;
    if (input.botToken?.trim()) {
      const me = await this.getMe(token);
      if (!me.ok) {
        throw new BadRequestException(`توکن ربات معتبر نیست: ${me.error}`);
      }
      botUsername = me.username;
    }

    await this.repo.save(
      this.repo.create({
        ...existing,
        workspaceId,
        botToken: token,
        botUsername,
        isActive: input.isActive ?? existing?.isActive ?? true,
      }),
    );
    return this.getBot(workspaceId);
  }

  async removeBot(workspaceId: string) {
    await this.recipientRepo.delete({ workspaceId });
    await this.repo.delete({ workspaceId });
    return { ok: true };
  }

  // ── مقصدها ────────────────────────────────────────────────────────────

  listRecipients(workspaceId: string) {
    return this.recipientRepo.find({
      where: { workspaceId },
      order: { createdAt: 'ASC' },
    });
  }

  async addRecipient(workspaceId: string, input: TelegramRecipientInput) {
    const chatId = input.chatId.trim();
    if (!chatId) throw new BadRequestException('شناسه‌ی گفتگو لازم است');

    const duplicate = await this.recipientRepo.findOne({
      where: {
        workspaceId,
        chatId,
        formId: input.formId ?? IsNull(),
      },
    });
    if (duplicate) {
      throw new BadRequestException(
        'این گفتگو برای همین فرم از قبل اضافه شده است',
      );
    }

    return this.recipientRepo.save(
      this.recipientRepo.create({
        workspaceId,
        formId: input.formId ?? null,
        chatId,
        label: input.label?.trim() ?? '',
        scoreThreshold: input.scoreThreshold ?? null,
        isActive: input.isActive ?? true,
      }),
    );
  }

  async updateRecipient(
    workspaceId: string,
    id: string,
    input: Partial<TelegramRecipientInput>,
  ) {
    const row = await this.recipientRepo.findOne({ where: { id, workspaceId } });
    if (!row) throw new BadRequestException('مقصد یافت نشد');

    await this.recipientRepo.update(
      { id },
      {
        label: input.label ?? row.label,
        scoreThreshold:
          input.scoreThreshold === undefined
            ? row.scoreThreshold
            : input.scoreThreshold,
        isActive: input.isActive ?? row.isActive,
      },
    );
    return this.recipientRepo.findOne({ where: { id } });
  }

  async removeRecipient(workspaceId: string, id: string) {
    await this.recipientRepo.delete({ id, workspaceId });
    return { ok: true };
  }

  /** پیام آزمایشی به یک مقصد؛ برخلاف ارسال خودکار، خطا را برمی‌گرداند. */
  async sendTest(workspaceId: string, recipientId: string) {
    const bot = await this.repo.findOne({ where: { workspaceId } });
    if (!bot) throw new BadRequestException('ابتدا ربات را تنظیم کنید');

    const recipient = await this.recipientRepo.findOne({
      where: { id: recipientId, workspaceId },
    });
    if (!recipient) throw new BadRequestException('مقصد یافت نشد');

    const result = await this.send(
      bot.botToken,
      recipient.chatId,
      '✅ اتصال SamaLine به این گفتگو برقرار است.',
    );
    if (!result.ok) {
      await this.recipientRepo.update(
        { id: recipient.id },
        { lastError: result.error.slice(0, 300) },
      );
      throw new BadRequestException(`ارسال ناموفق: ${result.error}`);
    }
    await this.recipientRepo.update(
      { id: recipient.id },
      { lastSentAt: new Date(), lastError: null },
    );
    return { ok: true };
  }

  /**
   * شناسه‌ی گفتگوهایی که به‌تازگی به ربات پیام داده‌اند.
   *
   * پیدا کردن chat id دستی سخت‌ترین قدم راه‌اندازی است؛ با این، کاربر فقط
   * در تلگرام به ربات پیام می‌دهد و شناسه را از فهرست انتخاب می‌کند.
   */
  async discoverChats(workspaceId: string) {
    const bot = await this.repo.findOne({ where: { workspaceId } });
    if (!bot) throw new BadRequestException('ابتدا ربات را تنظیم کنید');

    try {
      const response = await fetch(
        `${TELEGRAM_API}/bot${bot.botToken}/getUpdates?limit=100`,
        { signal: AbortSignal.timeout(8000) },
      );
      const body = (await response.json()) as {
        ok?: boolean;
        description?: string;
        result?: Array<Record<string, { chat?: TelegramChat }>>;
      };
      if (!body.ok) {
        throw new BadRequestException(
          body.description ?? 'تلگرام پاسخ نداد',
        );
      }

      const chats = new Map<string, { id: string; title: string }>();
      for (const update of body.result ?? []) {
        for (const value of Object.values(update)) {
          const chat = value?.chat;
          if (!chat) continue;
          chats.set(String(chat.id), {
            id: String(chat.id),
            title: chatTitle(chat),
          });
        }
      }
      return [...chats.values()];
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(
        `ارتباط با تلگرام برقرار نشد: ${(error as Error).message}`,
      );
    }
  }

  // ── ارسال خودکار ──────────────────────────────────────────────────────

  /**
   * اطلاع‌رسانی یک پاسخ تازه به همه‌ی مقصدهای آن فرم.
   *
   * هرگز throw نمی‌کند: از داخل مسیر ثبت پاسخ صدا زده می‌شود.
   */
  async notifyResponse(input: {
    workspaceId: string;
    formId: string;
    formTitle: string;
    structure: FormStructure;
    answers: Record<string, unknown>;
    scores: Record<string, number>;
  }): Promise<void> {
    try {
      const bot = await this.repo.findOne({
        where: { workspaceId: input.workspaceId },
      });
      if (!bot?.isActive || !bot.botToken) return;

      const recipients = await this.recipientRepo.find({
        where: [
          { workspaceId: input.workspaceId, formId: input.formId },
          { workspaceId: input.workspaceId, formId: IsNull() },
        ],
      });

      const targets = recipients.filter(
        (r) => r.isActive && this.passesThreshold(r, input.scores),
      );
      if (targets.length === 0) return;

      const message = this.buildMessage(input);

      // ارسال‌ها موازی‌اند: یک گفتگوی کند نباید بقیه را عقب بیندازد.
      await Promise.all(
        targets.map(async (recipient) => {
          const result = await this.send(bot.botToken, recipient.chatId, message);
          await this.recipientRepo.update(
            { id: recipient.id },
            result.ok
              ? { lastSentAt: new Date(), lastError: null }
              : { lastError: result.error.slice(0, 300) },
          );
        }),
      );
    } catch (error) {
      this.logger.warn(
        `اطلاع‌رسانی تلگرام انجام نشد: ${(error as Error).message}`,
      );
    }
  }

  private passesThreshold(
    recipient: TelegramRecipientEntity,
    scores: Record<string, number>,
  ): boolean {
    if (recipient.scoreThreshold === null) return true;
    const values = Object.values(scores);
    // بدون امتیاز نمی‌شود درباره‌ی آستانه قضاوت کرد؛ چنین پاسخی فرستاده
    // می‌شود تا از قلم نیفتد.
    if (values.length === 0) return true;
    return Math.min(...values) < recipient.scoreThreshold;
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
    return `${message.slice(0, MAX_MESSAGE - 40)}\n\n… (ادامه در پنل)`;
  }

  private async getMe(
    token: string,
  ): Promise<
    { ok: true; username: string | null } | { ok: false; error: string }
  > {
    try {
      const response = await fetch(`${TELEGRAM_API}/bot${token}/getMe`, {
        signal: AbortSignal.timeout(8000),
      });
      const body = (await response.json()) as {
        ok?: boolean;
        description?: string;
        result?: { username?: string };
      };
      if (!body.ok) {
        return { ok: false, error: body.description ?? `پاسخ ${response.status}` };
      }
      return { ok: true, username: body.result?.username ?? null };
    } catch (error) {
      return { ok: false, error: (error as Error).message };
    }
  }

  private async send(
    botToken: string,
    chatId: string,
    text: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    try {
      const response = await fetch(`${TELEGRAM_API}/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
        // بدون مهلت، یک تلگرام کند مسیر ثبت پاسخ را نگه می‌دارد.
        signal: AbortSignal.timeout(8000),
      });

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

interface TelegramChat {
  id: number | string;
  title?: string;
  username?: string;
  first_name?: string;
  type?: string;
}

function chatTitle(chat: TelegramChat): string {
  return (
    chat.title ??
    [chat.first_name, chat.username && `@${chat.username}`]
      .filter(Boolean)
      .join(' ') ??
    String(chat.id)
  );
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
