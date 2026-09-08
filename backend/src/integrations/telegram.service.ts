import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { TelegramIntegrationEntity } from '../database/entities/telegram-integration.entity';
import { TelegramRecipientEntity } from '../database/entities/telegram-recipient.entity';
import { WorkspaceEntity } from '../database/entities/workspace.entity';
import { PlatformSettingsService } from '../platform/platform-settings.service';
import type { FormQuestionNode, FormStructure } from '../forms/logic-types';
import { randomBytes } from 'crypto';
import { MAX_MESSAGE, TelegramApi } from './telegram-api';

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
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepo: Repository<WorkspaceEntity>,
    private readonly platformSettings: PlatformSettingsService,
    private readonly api: TelegramApi,
  ) {}

  /**
   * بررسی می‌کند فضای کاری متعلق به سازمان کاربر باشد.
   *
   * `workspaceId` از درخواست می‌آید، پس بدون این بررسی هر کاربر واردشده
   * می‌توانست با حدس زدن شناسه، توکن ربات سازمان دیگری را عوض کند یا
   * پاسخ‌های فرم‌های آن سازمان را به گفتگوی خودش هدایت کند.
   */
  async assertAccess(
    workspaceId: string,
    user: { sub: string; organizationId: string },
  ): Promise<void> {
    if (await this.platformSettings.isSuperAdmin(user.sub)) return;

    const workspace = await this.workspaceRepo.findOne({
      where: { id: workspaceId },
    });
    if (!workspace || workspace.organizationId !== user.organizationId) {
      throw new ForbiddenException('به این فضای کاری دسترسی ندارید');
    }
  }

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
      const me = await this.api.getMe(token);
      if (!me.ok) {
        throw new BadRequestException(`توکن ربات معتبر نیست: ${me.error}`);
      }
      botUsername = me.username;
    }

    /*
     * توکن وبهوک یک بار ساخته می‌شود و بعد ثابت می‌ماند؛ عوض شدنش یعنی
     * نشانی ثبت‌شده در تلگرام دیگر کار نمی‌کند.
     */
    const webhookToken = existing?.webhookToken ?? randomBytes(24).toString("hex");

    await this.repo.save(
      this.repo.create({
        ...existing,
        workspaceId,
        botToken: token,
        botUsername,
        webhookToken,
        isActive: input.isActive ?? existing?.isActive ?? true,
      }),
    );

    await this.registerWebhook(token, webhookToken);
    return this.getBot(workspaceId);
  }

  /**
   * ثبت نشانی وبهوک در تلگرام.
   *
   * بدون `PUBLIC_URL` از این کار صرف‌نظر می‌شود و فقط هشدار می‌دهد: ارسال
   * پاسخ‌ها و گزارش دوره‌ای بدون وبهوک هم کار می‌کند؛ چیزی که کار نمی‌کند
   * فرمان‌های خودِ ربات است. شکستن کل ذخیره‌ی توکن به‌خاطر آن، بی‌دلیل است.
   */
  private async registerWebhook(botToken: string, webhookToken: string) {
    const base = process.env.PUBLIC_URL?.replace(/\/+$/, '');
    if (!base) {
      this.logger.warn(
        "PUBLIC_URL تنظیم نشده؛ وبهوک ثبت نشد و فرمان‌های ربات کار نمی‌کنند.",
      );
      return;
    }

    const url = `${base}/api/v1/public/telegram/webhook/${webhookToken}`;
    const result = await this.api.setWebhook(botToken, url);
    if (!result.ok) {
      this.logger.warn(`ثبت وبهوک تلگرام ناموفق بود: ${result.error}`);
    }
  }

  async removeBot(workspaceId: string) {
    const existing = await this.repo.findOne({ where: { workspaceId } });
    // وبهوک پیش از حذف ردیف برداشته می‌شود، وگرنه تلگرام تا ابد به نشانی
    // مرده پیام می‌فرستد.
    if (existing?.botToken) await this.api.deleteWebhook(existing.botToken);

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

    const result = await this.api.send(
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

    const result = await this.api.getUpdates(bot.botToken);
    if (!result.ok) {
      throw new BadRequestException(
        `ارتباط با تلگرام برقرار نشد: ${result.error}`,
      );
    }

    const chats = new Map<string, { id: string; title: string }>();
    for (const update of result.updates as Array<
      Record<string, { chat?: TelegramChat }>
    >) {
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
          const result = await this.api.send(
      bot.botToken,
      recipient.chatId, message);
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
