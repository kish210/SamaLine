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
