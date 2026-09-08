import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { FormEntity } from '../database/entities/form.entity';
import { TelegramIntegrationEntity } from '../database/entities/telegram-integration.entity';
import { TelegramLinkCodeEntity } from '../database/entities/telegram-link-code.entity';
import { TelegramRecipientEntity } from '../database/entities/telegram-recipient.entity';
import { TelegramApi } from './telegram-api';

/** عمر کد اتصال. کوتاه است چون کد در تلگرام رد و بدل می‌شود. */
const CODE_TTL_MINUTES = 30;

/**
 * حروف کد اتصال.
 *
 * حروف و ارقام مبهم (O/0، I/1/l) عمداً نیستند: کاربر کد را از صفحه‌ی پنل
 * می‌خواند و در تلگرام تایپ می‌کند، و یک اشتباه خواندن یعنی «کد نامعتبر».
 */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** یک به‌روزرسانی تلگرام؛ فقط بخش‌هایی که استفاده می‌شود. */
interface TelegramUpdate {
  message?: {
    text?: string;
    chat?: { id: number | string; title?: string; first_name?: string; username?: string };
    from?: { first_name?: string; username?: string };
  };
}

/**
 * فرمان‌های خودِ ربات تلگرام.
 *
 * هدفش این است که مدیر مجموعه بدون ورود به پنل، گفتگویش را به یک فرم وصل
 * کند و گزارش بگیرد. نکته‌ی حساس امنیتی: هر کسی می‌تواند به ربات پیام
 * بدهد، پس ربات از روی خودِ پیام نمی‌فهمد فرستنده حق دیدن کدام فرم را
 * دارد. اتصال فقط با کد یک‌بارمصرفی انجام می‌شود که در پنل ساخته شده —
 * یعنی کسی که کد دارد، به پنل دسترسی داشته.
 */
@Injectable()
export class TelegramBotService {
  private readonly logger = new Logger(TelegramBotService.name);

  constructor(
    @InjectRepository(TelegramIntegrationEntity)
    private readonly botRepo: Repository<TelegramIntegrationEntity>,
    @InjectRepository(TelegramRecipientEntity)
    private readonly recipientRepo: Repository<TelegramRecipientEntity>,
    @InjectRepository(TelegramLinkCodeEntity)
    private readonly codeRepo: Repository<TelegramLinkCodeEntity>,
    @InjectRepository(FormEntity)
    private readonly formRepo: Repository<FormEntity>,
    private readonly api: TelegramApi,
  ) {}

  // ── کد اتصال ──────────────────────────────────────────────────────────

  /** ساخت کد یک‌بارمصرف برای وصل کردن یک گفتگو به یک فرم. */
  async createLinkCode(input: {
    workspaceId: string;
    formId: string | null;
    label: string;
  }) {
    // کدهای منقضی انباشته می‌شوند؛ همین‌جا پاک می‌شوند تا جدول رشد نکند.
    await this.codeRepo.delete({ expiresAt: LessThan(new Date()) });

    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000);

    await this.codeRepo.save(
      this.codeRepo.create({
        code,
        workspaceId: input.workspaceId,
        formId: input.formId,
        label: input.label.trim(),
        expiresAt,
        usedAt: null,
      }),
    );

    const bot = await this.botRepo.findOne({
      where: { workspaceId: input.workspaceId },
    });

    return {
      code,
      expiresAt,
      expiresInMinutes: CODE_TTL_MINUTES,
      botUsername: bot?.botUsername ?? null,
    };
  }

  private generateCode(): string {
    const bytes = randomBytes(8);
    return [...bytes]
      .map((b) => CODE_ALPHABET[b % CODE_ALPHABET.length])
      .join('');
  }

  // ── دریافت پیام از تلگرام ─────────────────────────────────────────────

  /**
   * پردازش یک به‌روزرسانی وبهوک.
   *
   * هرگز throw نمی‌کند: تلگرام در برابر خطا، همان به‌روزرسانی را بارها
   * دوباره می‌فرستد و یک باگ می‌تواند به حلقه‌ی بی‌پایان تبدیل شود.
   */
  async handleUpdate(webhookToken: string, update: TelegramUpdate) {
    try {
      const bot = await this.botRepo.findOne({ where: { webhookToken } });
      if (!bot) return;

      const chat = update.message?.chat;
      const text = update.message?.text?.trim();
      if (!chat || !text) return;

      const chatId = String(chat.id);
      const reply = await this.respond(bot, chatId, text, chat);
      if (reply) await this.api.send(bot.botToken, chatId, reply);
    } catch (error) {
      this.logger.warn(
        `پردازش پیام تلگرام ناموفق بود: ${(error as Error).message}`,
      );
    }
  }

  private async respond(
    bot: TelegramIntegrationEntity,
    chatId: string,
    text: string,
    chat: NonNullable<TelegramUpdate['message']>['chat'],
  ): Promise<string | null> {
    const [rawCommand, ...rest] = text.split(/\s+/);
    const command = rawCommand.toLowerCase().replace(/@.*$/, '');
    const argument = rest.join(' ').trim();

    switch (command) {
      case '/start':
        return argument
          ? this.link(bot, chatId, argument, chat)
          : this.help(bot);

      case '/help':
      case '/راهنما':
        return this.help(bot);

      case '/forms':
      case '/فرمها':
        return this.listForms(bot, chatId);

      case '/weekly':
      case '/هفتگی':
        return this.setDigest(bot, chatId, 'weekly');

      case '/monthly':
      case '/ماهانه':
        return this.setDigest(bot, chatId, 'monthly');

      case '/nodigest':
      case '/بدونگزارش':
        return this.setDigest(bot, chatId, 'none');

      case '/mute':
      case '/بیصدا':
        return this.setNotify(bot, chatId, false);

      case '/unmute':
      case '/باصدا':
        return this.setNotify(bot, chatId, true);

      case '/stop':
      case '/قطع':
        return this.stop(bot, chatId);

      default:
        /*
         * پیام بدون اسلش هم به‌عنوان کد اتصال امتحان می‌شود.
         *
         * کاربری که کد را کپی می‌کند معمولا بدون «/start» می‌فرستد؛ رد
         * کردنش با «فرمان ناشناخته» بی‌دلیل او را سرگردان می‌کند.
         */
        if (/^[A-Za-z0-9]{6,16}$/.test(text)) {
          return this.link(bot, chatId, text, chat);
        }
        return this.help(bot);
    }
  }

  private help(bot: TelegramIntegrationEntity): string {
    return [
      `🤖 <b>ربات ${escapeHtml(bot.botUsername ?? 'SamaLine')}</b>`,
      '',
      'برای وصل شدن به یک فرم، کدی که در پنل ساخته‌اید را همین‌جا بفرستید.',
      '',
      '<b>فرمان‌ها:</b>',
      '/forms — فرم‌هایی که این گفتگو دریافت می‌کند',
      '/weekly — گزارش هفتگی روشن',
      '/monthly — گزارش ماهانه روشن',
      '/nodigest — گزارش دوره‌ای خاموش',
      '/mute — اعلان تک‌تک پاسخ‌ها خاموش',
      '/unmute — اعلان تک‌تک پاسخ‌ها روشن',
      '/stop — قطع کامل این گفتگو',
    ].join('\n');
  }

  /** مصرف کد و ساخت مقصد. */
  private async link(
    bot: TelegramIntegrationEntity,
    chatId: string,
    rawCode: string,
    chat: NonNullable<TelegramUpdate['message']>['chat'],
  ): Promise<string> {
    const code = rawCode.trim().toUpperCase();
    const row = await this.codeRepo.findOne({ where: { code } });

    if (!row || row.usedAt || row.expiresAt < new Date()) {
      return '❌ کد نامعتبر یا منقضی است. از پنل کد تازه بگیرید.';
    }
    /*
     * کد فقط برای رباتِ همان فضای کاری معتبر است.
     *
     * بدون این بررسی، کدِ یک مجموعه را می‌شد به ربات مجموعه‌ی دیگری داد و
     * مقصدی ساخت که ربات دیگری به آن پیام می‌دهد.
     */
    if (row.workspaceId !== bot.workspaceId) {
      return '❌ این کد برای ربات دیگری ساخته شده است.';
    }

    const existing = await this.recipientRepo.findOne({
      where: {
        workspaceId: row.workspaceId,
        chatId,
        formId: row.formId ?? IsNull(),
      },
    });

    if (existing) {
      await this.recipientRepo.update(
        { id: existing.id },
        { isActive: true, label: row.label || existing.label },
      );
    } else {
      await this.recipientRepo.save(
        this.recipientRepo.create({
          workspaceId: row.workspaceId,
          formId: row.formId,
          chatId,
          label: row.label || chatTitle(chat),
          isActive: true,
          notifyOnResponse: true,
          digest: 'none',
        }),
      );
    }

    await this.codeRepo.update({ id: row.id }, { usedAt: new Date() });

    const formName = await this.formName(row.formId);
    return [
      `✅ این گفتگو به <b>${escapeHtml(formName)}</b> وصل شد.`,
      '',
      'از این پس پاسخ‌های تازه اینجا می‌آید.',
      'برای خلاصه‌ی دوره‌ای: /weekly یا /monthly',
    ].join('\n');
  }

  private async listForms(
    bot: TelegramIntegrationEntity,
    chatId: string,
  ): Promise<string> {
    const rows = await this.recipientRepo.find({
      where: { workspaceId: bot.workspaceId, chatId },
      order: { createdAt: 'ASC' },
    });

    if (rows.length === 0) {
      return 'این گفتگو به هیچ فرمی وصل نیست. کد اتصال را از پنل بگیرید و اینجا بفرستید.';
    }

    const lines = ['<b>فرم‌های این گفتگو:</b>', ''];
    for (const row of rows) {
      const name = await this.formName(row.formId);
      const state = row.isActive ? '' : ' (غیرفعال)';
      const digest =
        row.digest === 'weekly'
          ? ' · گزارش هفتگی'
          : row.digest === 'monthly'
            ? ' · گزارش ماهانه'
            : '';
      const muted = row.notifyOnResponse ? '' : ' · بی‌صدا';
      lines.push(`• ${escapeHtml(name)}${state}${digest}${muted}`);
    }
    return lines.join('\n');
  }

  private async setDigest(
    bot: TelegramIntegrationEntity,
    chatId: string,
    digest: 'none' | 'weekly' | 'monthly',
  ): Promise<string> {
    const { affected } = await this.recipientRepo.update(
      { workspaceId: bot.workspaceId, chatId },
      // مبدأ شمارش از حالا؛ وگرنه اولین گزارش ممکن است بلافاصله برود.
      { digest, lastDigestAt: new Date() },
    );

    if (!affected) return 'این گفتگو به هیچ فرمی وصل نیست.';
    return digest === 'none'
      ? '✅ گزارش دوره‌ای خاموش شد.'
      : `✅ گزارش ${digest === 'weekly' ? 'هفتگی' : 'ماهانه'} روشن شد.`;
  }

  private async setNotify(
    bot: TelegramIntegrationEntity,
    chatId: string,
    notifyOnResponse: boolean,
  ): Promise<string> {
    const { affected } = await this.recipientRepo.update(
      { workspaceId: bot.workspaceId, chatId },
      { notifyOnResponse },
    );
    if (!affected) return 'این گفتگو به هیچ فرمی وصل نیست.';
    return notifyOnResponse
      ? '✅ اعلان هر پاسخ روشن شد.'
      : '🔕 اعلان هر پاسخ خاموش شد. گزارش دوره‌ای دست‌نخورده است.';
  }

  private async stop(
    bot: TelegramIntegrationEntity,
    chatId: string,
  ): Promise<string> {
    const { affected } = await this.recipientRepo.delete({
      workspaceId: bot.workspaceId,
      chatId,
    });
    return affected
      ? '✅ این گفتگو از همه‌ی فرم‌ها قطع شد.'
      : 'این گفتگو به هیچ فرمی وصل نبود.';
  }

  private async formName(formId: string | null): Promise<string> {
    if (!formId) return 'همه‌ی فرم‌ها';
    const form = await this.formRepo.findOne({ where: { id: formId } });
    return form?.title ?? 'فرم حذف‌شده';
  }
}

function chatTitle(
  chat: NonNullable<TelegramUpdate['message']>['chat'],
): string {
  if (!chat) return '';
  return (
    chat.title ??
    [chat.first_name, chat.username && `@${chat.username}`]
      .filter(Boolean)
      .join(' ') ??
    String(chat.id)
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
