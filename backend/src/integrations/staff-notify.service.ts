import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TelegramIntegrationEntity } from '../database/entities/telegram-integration.entity';
import { HrService } from '../hr/hr.service';
import { TelegramApi, platformApiBase } from './telegram-api';

export interface ReviewNotification {
  organizationId: string;
  workspaceId: string;
  /** کلیدِ پاسخ‌دهنده؛ برای درخواست‌های احراز‌شده‌ی موبایلی = شماره موبایل. */
  respondentKey: string | null;
  formTitle: string;
  decision: 'approved' | 'rejected';
  note?: string;
}

/**
 * اعلانِ نتیجهٔ گردش‌کارِ تأیید به رباتِ پرسنل (فاز F).
 *
 * اتصالِ فاز E (تأیید/رد) را به اتصالِ بله‌ی فاز F وصل می‌کند: وقتی مدیر
 * درخواستی را بررسی کرد و پاسخ‌دهنده پرسنلِ وصل‌به‌ربات باشد، پیامِ بله به او
 * می‌رود. تطبیق با موبایل است؛ پس فقط درخواست‌هایی که با موبایل ثبت شده‌اند
 * (OTP موبایلی) به پرسنل می‌رسند — پاسخ‌های بی‌نام یا ایمیلی بی‌صدا رد می‌شوند.
 *
 * هرگز throw نمی‌کند: اعلان نباید مسیرِ تأیید را در پنل بشکند.
 */
@Injectable()
export class StaffNotifyService {
  private readonly logger = new Logger(StaffNotifyService.name);

  constructor(
    @InjectRepository(TelegramIntegrationEntity)
    private readonly botRepo: Repository<TelegramIntegrationEntity>,
    private readonly hr: HrService,
    private readonly api: TelegramApi,
  ) {}

  /**
   * ارسالِ اطلاعیهٔ سازمانی به گفتگوی بله/تلگرامِ پرسنلِ وصل‌به‌ربات (فاز F).
   *
   * هر پرسنل فقط از همان رباتی پیام می‌گیرد که از طریقش وصل شده، پس گیرنده‌ها
   * بر اساسِ `botWorkspaceId` گروه می‌شوند و هر گروه با توکنِ رباتِ خودش پیام
   * می‌گیرد. اطلاعیه می‌تواند به یک بخش محدود شود. نتیجه: شمارِ ارسال‌شده/ردشده.
   */
  async broadcastAnnouncement(input: {
    organizationId: string;
    title: string;
    body: string;
    departmentId?: string | null;
  }): Promise<{ sent: number; skipped: number }> {
    const people = await this.hr.linkedPersonnel(
      input.organizationId,
      input.departmentId,
    );
    if (people.length === 0) return { sent: 0, skipped: 0 };

    const text = [
      `📢 <b>${escapeHtml(input.title)}</b>`,
      '',
      escapeHtml(input.body),
    ].join('\n');

    let sent = 0;
    let skipped = 0;
    // توکنِ هر فضای کاری یک‌بار خوانده می‌شود، نه به‌ازای هر پرسنل.
    const botCache = new Map<string, TelegramIntegrationEntity | null>();

    for (const person of people) {
      const wsId = person.botWorkspaceId;
      if (!wsId || !person.botChatId) {
        skipped += 1;
        continue;
      }
      if (!botCache.has(wsId)) {
        botCache.set(
          wsId,
          await this.botRepo.findOne({ where: { workspaceId: wsId } }),
        );
      }
      const bot = botCache.get(wsId) ?? null;
      if (!bot || !bot.isActive) {
        skipped += 1;
        continue;
      }

      const result = await this.api.send(
        bot.botToken,
        person.botChatId,
        text,
        platformApiBase(person.botPlatform || bot.platform),
      );
      if (result.ok) sent += 1;
      else skipped += 1;
    }

    return { sent, skipped };
  }

  async notifyReviewDecision(input: ReviewNotification): Promise<void> {
    try {
      if (!input.respondentKey) return;

      const person = await this.hr.findByMobile(
        input.organizationId,
        input.respondentKey,
      );
      if (!person?.botChatId) return;

      const bot = await this.botRepo.findOne({
        where: { workspaceId: input.workspaceId },
      });
      if (!bot || !bot.isActive) return;

      const headline =
        input.decision === 'approved'
          ? '✅ درخواستِ شما تأیید شد'
          : '❌ درخواستِ شما رد شد';
      const text = [
        headline,
        `فرم: <b>${escapeHtml(input.formTitle)}</b>`,
        input.note ? `یادداشت: ${escapeHtml(input.note)}` : '',
      ]
        .filter((line) => line !== '')
        .join('\n');

      await this.api.send(
        bot.botToken,
        person.botChatId,
        text,
        platformApiBase(person.botPlatform || bot.platform),
      );
    } catch (error) {
      this.logger.warn(
        `اعلانِ نتیجهٔ بررسی به پرسنل ناموفق بود: ${(error as Error).message}`,
      );
    }
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
