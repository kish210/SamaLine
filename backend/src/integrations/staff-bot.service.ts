import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkspaceEntity } from '../database/entities/workspace.entity';
import { HrService } from '../hr/hr.service';
import { AnnouncementService } from './announcement.service';
import { isoToJalaliText } from '../common/jalali';
import type { TelegramIntegrationEntity } from '../database/entities/telegram-integration.entity';

/** موبایلِ ایرانی: ۱۰ تا ۱۳ رقم (با/بی ۰ یا ۹۸). فقط رقم و نشانه‌های رایج. */
export function looksLikeMobile(text: string): boolean {
  const digits = text.replace(/[\s()+-]/g, '');
  return /^\d{10,13}$/.test(digits);
}

/**
 * رباتِ پرسنل (فاز F): کارمند با فرستادنِ شماره موبایلِ خود، گفتگوی بله/تلگرامش
 * را به پروندهٔ پرسنلِ خود وصل می‌کند.
 *
 * هویت از خودِ موبایل می‌آید که HR آن را ثبت کرده؛ پس فقط کسی که شماره‌ی
 * ثبت‌شده را دارد وصل می‌شود. این سرویس از رباتِ موجود (telegram/bale) استفاده
 * می‌کند و پیام‌های مدیریتیِ ربات را دست نمی‌زند: فقط پیام‌های شبیهِ موبایل و
 * چند فرمانِ پرسنلی را می‌گیرد.
 */
@Injectable()
export class StaffBotService {
  constructor(
    @InjectRepository(WorkspaceEntity)
    private readonly workspaces: Repository<WorkspaceEntity>,
    private readonly hr: HrService,
    private readonly announcements: AnnouncementService,
  ) {}

  /** سازمانِ یک ربات از فضای کاری‌اش. */
  private async orgIdOf(bot: TelegramIntegrationEntity): Promise<string | null> {
    const ws = await this.workspaces.findOne({
      where: { id: bot.workspaceId },
      select: { id: true, organizationId: true },
    });
    return ws?.organizationId ?? null;
  }

  /**
   * تلاش برای پاسخ‌دهیِ پرسنلی. اگر پیام مربوط به ربات پرسنل باشد رشته‌ی پاسخ
   * برمی‌گردد؛ وگرنه null تا رباتِ مدیریتی مثل قبل ادامه دهد.
   */
  async tryHandle(
    bot: TelegramIntegrationEntity,
    chatId: string,
    text: string,
  ): Promise<string | null> {
    const trimmed = text.trim();
    const command = trimmed.toLowerCase().replace(/@.*$/, '');

    if (command === '/me' || command === '/من') {
      return this.status(bot, chatId);
    }
    if (command === '/خروج' || command === '/leave') {
      return this.unlink(bot, chatId);
    }
    if (command === '/اطلاعیه' || command === '/news') {
      return this.recentAnnouncements(bot, chatId);
    }
    if (looksLikeMobile(trimmed)) {
      return this.link(bot, chatId, trimmed);
    }
    return null;
  }

  /**
   * آخرین اطلاعیه‌های مربوط به این پرسنل (فاز G): اطلاعیهٔ عمومیِ سازمان و
   * اطلاعیهٔ بخشِ خودش. فقط برای پرسنلِ وصل‌شده.
   */
  private async recentAnnouncements(
    bot: TelegramIntegrationEntity,
    chatId: string,
  ): Promise<string> {
    const person = await this.hr.findByChat(chatId, bot.platform);
    if (!person) {
      return 'شما هنوز وصل نشده‌اید. شماره موبایلِ خود را همین‌جا بفرستید.';
    }

    const all = await this.announcements.list(person.organizationId);
    const relevant = all
      .filter((a) => !a.departmentId || a.departmentId === person.departmentId)
      .slice(0, 5);

    if (relevant.length === 0) return 'اطلاعیه‌ای برای شما نیست.';

    const lines = ['📢 <b>آخرین اطلاعیه‌ها</b>', ''];
    for (const a of relevant) {
      const date = isoToJalaliText(new Date(a.createdAt).toISOString());
      lines.push(`<b>${escapeHtml(a.title)}</b>${date ? ` — ${date}` : ''}`);
      lines.push(escapeHtml(a.body));
      lines.push('');
    }
    return lines.join('\n').trim();
  }

  private async link(
    bot: TelegramIntegrationEntity,
    chatId: string,
    mobile: string,
  ): Promise<string> {
    const organizationId = await this.orgIdOf(bot);
    if (!organizationId) return '❌ این ربات به سازمانی وصل نیست.';

    const person = await this.hr.linkBotChat(
      organizationId,
      mobile,
      chatId,
      bot.platform,
      bot.workspaceId,
    );
    if (!person) {
      return [
        '❌ این شماره در فهرستِ پرسنل پیدا نشد.',
        'اگر تازه استخدام شده‌اید، از واحدِ منابع انسانی بخواهید شماره‌تان را ثبت کند.',
      ].join('\n');
    }

    return [
      `✅ خوش آمدید <b>${escapeHtml(person.fullName)}</b>.`,
      person.position ? `سمت: ${escapeHtml(person.position)}` : '',
      '',
      'از این پس وضعیتِ درخواست‌هایتان را اینجا دنبال می‌کنید.',
      'برای دیدنِ پروندهٔ خود: /me',
      'برای قطعِ اتصال: /خروج',
    ]
      .filter((line) => line !== '')
      .join('\n');
  }

  private async status(
    bot: TelegramIntegrationEntity,
    chatId: string,
  ): Promise<string> {
    const person = await this.hr.findByChat(chatId, bot.platform);
    if (!person) {
      return 'شما هنوز وصل نشده‌اید. شماره موبایلِ خود را همین‌جا بفرستید.';
    }
    return [
      `👤 <b>${escapeHtml(person.fullName)}</b>`,
      person.position ? `سمت: ${escapeHtml(person.position)}` : '',
      person.employeeNo ? `کد پرسنلی: ${escapeHtml(person.employeeNo)}` : '',
    ]
      .filter((line) => line !== '')
      .join('\n');
  }

  private async unlink(
    bot: TelegramIntegrationEntity,
    chatId: string,
  ): Promise<string> {
    const { unlinked } = await this.hr.unlinkBotChat(chatId, bot.platform);
    return unlinked
      ? '✅ اتصالِ شما قطع شد. برای وصلِ دوباره، شماره موبایل را بفرستید.'
      : 'شما وصل نبودید.';
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
