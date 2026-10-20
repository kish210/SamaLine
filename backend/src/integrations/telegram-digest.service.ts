import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { FormEntity } from '../database/entities/form.entity';
import { TelegramIntegrationEntity } from '../database/entities/telegram-integration.entity';
import { TelegramRecipientEntity } from '../database/entities/telegram-recipient.entity';
import { AnalyticsService } from '../reports/analytics.service';
import { isoToJalaliText } from '../common/jalali';
import { TelegramApi, platformApiBase } from './telegram-api';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** فاصله‌ی بررسی موعد. دقیق‌تر از این لازم نیست و فقط بار بی‌مصرف است. */
const CHECK_INTERVAL_MS = 30 * 60 * 1000;

const PERIOD_MS: Record<'weekly' | 'monthly', number> = {
  weekly: 7 * DAY,
  monthly: 30 * DAY,
};

/**
 * گزارش دوره‌ای فرم‌ها در تلگرام.
 *
 * زمان‌بندی عمداً با یک تایمر ساده و مقایسه‌ی `lastDigestAt` انجام می‌شود،
 * نه با cron: موعد روی خودِ ردیف ذخیره می‌شود، پس ری‌استارت سرور باعث
 * ارسال دوباره یا از دست رفتن یک دوره نمی‌شود — چیزی که با cronِ در حافظه
 * پیش می‌آمد.
 */
@Injectable()
export class TelegramDigestService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramDigestService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(TelegramRecipientEntity)
    private readonly recipientRepo: Repository<TelegramRecipientEntity>,
    @InjectRepository(TelegramIntegrationEntity)
    private readonly botRepo: Repository<TelegramIntegrationEntity>,
    @InjectRepository(FormEntity)
    private readonly formRepo: Repository<FormEntity>,
    private readonly analytics: AnalyticsService,
    private readonly api: TelegramApi,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.run(), CHECK_INTERVAL_MS);
    // تایمر نباید خاموش شدن برنامه را عقب بیندازد.
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** یک دور بررسی؛ برای تست و اجرای دستی هم قابل صدا زدن است. */
  async run(now = new Date()): Promise<number> {
    let sent = 0;
    try {
      const due = (
        await this.recipientRepo.find({
          where: { isActive: true, digest: Not('none' as never) },
        })
      ).filter((r) => this.isDue(r, now));

      for (const recipient of due) {
        if (await this.sendDigest(recipient, now)) sent += 1;
      }
    } catch (error) {
      this.logger.warn(
        `اجرای گزارش دوره‌ای ناموفق بود: ${(error as Error).message}`,
      );
    }
    return sent;
  }

  private isDue(recipient: TelegramRecipientEntity, now: Date): boolean {
    const period = PERIOD_MS[recipient.digest as 'weekly' | 'monthly'];
    if (!period) return false;
    // بدون ارسال قبلی، مبدأ ساخت مقصد است.
    const last = recipient.lastDigestAt ?? recipient.createdAt;
    return now.getTime() - new Date(last).getTime() >= period;
  }

  /**
   * گزارش فوری برای یک گفتگو، بدون توجه به موعد.
   *
   * پشت فرمان /report ربات است: مدیری که همین حالا عدد می‌خواهد نباید تا
   * پایان دوره صبر کند.
   */
  async sendNow(
    workspaceId: string,
    chatId: string,
    now = new Date(),
  ): Promise<number> {
    const rows = await this.recipientRepo.find({
      where: { workspaceId, chatId },
    });
    let sent = 0;
    for (const recipient of rows) {
      // مقصدی که گزارش دوره‌ای ندارد هم باید بتواند گزارش فوری بگیرد؛
      // بازه‌ی پیش‌فرض یک هفته است.
      const period =
        recipient.digest === 'monthly' ? 'monthly' : ('weekly' as const);
      if (await this.sendDigest({ ...recipient, digest: period }, now, false)) {
        sent += 1;
      }
    }
    return sent;
  }

  private async sendDigest(
    recipient: TelegramRecipientEntity,
    now: Date,
    /** گزارش زمان‌بندی‌شده موعد را جلو می‌برد؛ گزارش فوری نباید. */
    advanceSchedule = true,
  ): Promise<boolean> {
    const bot = await this.botRepo.findOne({
      where: { workspaceId: recipient.workspaceId },
    });
    if (!bot?.isActive || !bot.botToken) return false;

    const period = PERIOD_MS[recipient.digest as 'weekly' | 'monthly'];
    const from = new Date(now.getTime() - period);

    const forms = recipient.formId
      ? await this.formRepo.find({ where: { id: recipient.formId } })
      : await this.formRepo.find({
          where: { workspaceId: recipient.workspaceId },
        });

    if (forms.length === 0) return false;

    const sections: string[] = [];
    for (const form of forms) {
      sections.push(await this.formSection(form, from, now));
    }

    const title =
      recipient.digest === 'weekly' ? 'گزارش هفتگی' : 'گزارش ماهانه';
    const message = [
      `📊 <b>${title}</b>`,
      `${isoToJalaliText(isoDay(from))} تا ${isoToJalaliText(isoDay(now))}`,
      '',
      ...sections,
    ].join('\n');

    const result = await this.api.send(
      bot.botToken,
      recipient.chatId,
      message,
      platformApiBase(bot.platform),
    );

    /*
     * `lastDigestAt` حتی در صورت شکست به‌روز می‌شود.
     *
     * وگرنه یک گفتگوی مسدودشده هر نیم‌ساعت دوباره تلاش می‌شود و تلگرام
     * ربات را محدود می‌کند. خطا روی ردیف می‌ماند تا در پنل دیده شود.
     */
    await this.recipientRepo.update(
      { id: recipient.id },
      result.ok
        ? {
            ...(advanceSchedule ? { lastDigestAt: now } : {}),
            lastSentAt: now,
            lastError: null,
          }
        : {
            ...(advanceSchedule ? { lastDigestAt: now } : {}),
            lastError: result.error.slice(0, 300),
          },
    );

    return result.ok;
  }

  private async formSection(
    form: FormEntity,
    from: Date,
    to: Date,
  ): Promise<string> {
    try {
      const data = await this.analytics.forForm(form.id, {
        from: isoDay(from),
        to: isoDay(to),
      });

      const lines = [`<b>${escapeHtml(form.title)}</b>`];
      lines.push(`• پاسخ تکمیل‌شده: ${data.totalResponses}`);

      if (data.totalResponses === 0) {
        lines.push('• در این بازه پاسخی ثبت نشد.');
        return lines.join('\n');
      }

      for (const score of data.scores) {
        const rate = score.rate === null ? '' : ` (${score.rate}٪)`;
        lines.push(`• ${escapeHtml(score.key)}: ${score.average}${rate}`);
      }

      /*
       * سه سوالی که پایین‌ترین میانگین را دارند.
       *
       * مدیری که گزارش دوره‌ای می‌خواند دنبال «کجا بد بودیم» است، نه فهرست
       * کامل؛ آوردن همه‌ی سوال‌ها پیام را از حد تلگرام هم رد می‌کند.
       */
      const worst = data.questions
        .filter((q) => q.average !== null && q.answered > 0)
        .sort((a, b) => (a.average ?? 0) - (b.average ?? 0))
        .slice(0, 3);

      if (worst.length > 0) {
        lines.push('', '<i>کمترین امتیازها:</i>');
        for (const question of worst) {
          lines.push(`• ${escapeHtml(question.title)}: ${question.average}`);
        }
      }

      return lines.join('\n');
    } catch (error) {
      this.logger.warn(
        `ساخت گزارش فرم ${form.id} ناموفق بود: ${(error as Error).message}`,
      );
      return `<b>${escapeHtml(form.title)}</b>\n• گزارش این فرم ساخته نشد.`;
    }
  }
}

function isoDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
