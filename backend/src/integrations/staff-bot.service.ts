import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkspaceEntity } from '../database/entities/workspace.entity';
import {
  ResponseEntity,
  ResponseStatus,
} from '../database/entities/response.entity';
import { HrService } from '../hr/hr.service';
import { AnnouncementService } from './announcement.service';
import { isoToJalaliText } from '../common/jalali';
import type { TelegramIntegrationEntity } from '../database/entities/telegram-integration.entity';

/** موبایلِ ایرانی: ۱۰ تا ۱۳ رقم (با/بی ۰ یا ۹۸). فقط رقم و نشانه‌های رایج. */
export function looksLikeMobile(text: string): boolean {
  const digits = text.replace(/[\s()+-]/g, '');
  return /^\d{10,13}$/.test(digits);
}

/** پاسخِ ربات: یا فقط متن، یا متن + کیبورد (reply_markup). */
export type BotReply = string | { text: string; keyboard?: Record<string, unknown> };

/** متنِ دکمه‌های انتخابِ نوع (کاربر با زدنشان همین متن را می‌فرستد). */
const BTN_STAFF = '👤 ورود پرسنل';
const BTN_MANAGER = '⚙️ راهنمای مدیریت';
const BTN_REQUESTS = '📋 درخواست‌های من';
const BTN_NEWS = '📢 اطلاعیه‌ها';
const BTN_ME = '👤 پرونده‌ی من';
const BTN_LOGOUT = '🚪 خروج';

/** کیبوردِ انتخابِ نوعِ کاربر هنگامِ شروع (برای کسی که هنوز وصل نیست). */
const TYPE_KEYBOARD = {
  keyboard: [[{ text: BTN_STAFF }], [{ text: BTN_MANAGER }]],
  resize_keyboard: true,
};

/** کیبوردِ پرسنلِ وصل‌شده. */
const STAFF_KEYBOARD = {
  keyboard: [
    [{ text: BTN_REQUESTS }, { text: BTN_NEWS }],
    [{ text: BTN_ME }, { text: BTN_LOGOUT }],
  ],
  resize_keyboard: true,
};

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
    @InjectRepository(ResponseEntity)
    private readonly responses: Repository<ResponseEntity>,
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
  ): Promise<BotReply | null> {
    const trimmed = text.trim();
    const command = trimmed.toLowerCase().replace(/@.*$/, '');

    /*
     * تفکیکِ سخت‌گیرانه‌ی نوع (خواسته‌ی کارفرما): هنگامِ شروع، اول نوعِ کاربر
     * مشخص می‌شود. پرسنلِ وصل‌شده منوی خودش را با کیبورد می‌گیرد؛ کسی که وصل
     * نیست بینِ «پرسنل» و «مدیریت» انتخاب می‌کند تا پاسخِ مربوط به خودش را ببیند.
     */
    if (command === '/start' || command === '/شروع') {
      // /start با آرگومان = کدِ اتصالِ مدیر؛ بگذار رباتِ مدیریتی هندل کند.
      if (/\s/.test(trimmed)) return null;
      const linkedAtStart = await this.hr.findByChat(chatId, bot.platform);
      if (linkedAtStart) {
        return { text: this.menuText(linkedAtStart), keyboard: STAFF_KEYBOARD };
      }
      return {
        text: [
          '👋 به ربات هتل خوش آمدید.',
          'لطفاً نوعِ خود را انتخاب کنید تا پاسخِ مربوط به خودتان را بگیرید:',
        ].join('\n'),
        keyboard: TYPE_KEYBOARD,
      };
    }

    if (trimmed === BTN_STAFF) {
      return 'شماره موبایلِ ثبت‌شده‌تان در واحدِ منابع انسانی را همین‌جا بفرستید تا وصل شوید.';
    }
    if (trimmed === BTN_MANAGER) {
      return [
        '⚙️ بخشِ مدیریت.',
        'برای اتصالِ گزارش‌های یک فرم به این گفتگو، از پنل «کدِ اتصال» بگیرید و',
        'به‌صورتِ /start <کد> بفرستید. راهنما: /راهنما',
      ].join('\n');
    }

    if (command === '/me' || command === '/من' || trimmed === BTN_ME) {
      return this.status(bot, chatId);
    }
    if (command === '/خروج' || command === '/leave' || trimmed === BTN_LOGOUT) {
      return this.unlink(bot, chatId);
    }
    if (command === '/اطلاعیه' || command === '/news' || trimmed === BTN_NEWS) {
      return this.recentAnnouncements(bot, chatId);
    }
    if (
      command === '/درخواست‌ها' ||
      command === '/درخواستها' ||
      command === '/requests' ||
      trimmed === BTN_REQUESTS
    ) {
      return this.myRequests(bot, chatId);
    }
    if (looksLikeMobile(trimmed)) {
      return this.link(bot, chatId, trimmed);
    }
    return null;
  }

  /** متنِ منوی پرسنلِ وصل‌شده. */
  private menuText(person: { fullName: string; position?: string | null }): string {
    return [
      `👤 <b>${escapeHtml(person.fullName)}</b> خوش آمدید.`,
      person.position ? `سمت: ${escapeHtml(person.position)}` : '',
      '',
      'از دکمه‌های پایین استفاده کنید یا فرمان بزنید:',
      'درخواست‌های من · اطلاعیه‌ها · پرونده‌ی من · خروج',
    ]
      .filter((l) => l !== '')
      .join('\n');
  }

  /**
   * «درخواست‌های من» در بله: پنج درخواستِ اخیرِ همین پرسنل با وضعیتِ تأیید.
   *
   * تطبیق با موبایل است، همان کلیدی که اعلانِ نتیجهٔ تأیید هم با آن کار می‌کند:
   * درخواست‌هایی که با OTPِ موبایلی ثبت شده‌اند کلیدِ پاسخ‌دهنده‌شان همین موبایل
   * است. فقط پاسخ‌های فرم‌های همان سازمانِ پرسنل خوانده می‌شوند.
   */
  private async myRequests(
    bot: TelegramIntegrationEntity,
    chatId: string,
  ): Promise<string> {
    const person = await this.hr.findByChat(chatId, bot.platform);
    if (!person) {
      return 'شما هنوز وصل نشده‌اید. شماره موبایلِ خود را همین‌جا بفرستید.';
    }
    if (!person.mobile) return 'شماره موبایلی برای پروندهٔ شما ثبت نشده است.';

    const rows = await this.responses
      .createQueryBuilder('response')
      .innerJoinAndSelect('response.formVersion', 'formVersion')
      .innerJoinAndSelect('formVersion.form', 'form')
      .innerJoin('form.workspace', 'workspace')
      .where('response.respondentKey = :key', { key: person.mobile })
      .andWhere('workspace.organizationId = :org', {
        org: person.organizationId,
      })
      .andWhere('response.status = :status', {
        status: ResponseStatus.COMPLETED,
      })
      .orderBy('response.createdAt', 'DESC')
      .take(5)
      .getMany();

    if (rows.length === 0) return 'درخواستی از شما ثبت نشده است.';

    const labels: Record<string, string> = {
      pending: '⏳ در انتظار تأیید',
      approved: '✅ تأییدشده',
      rejected: '❌ ردشده',
    };
    const lines = ['📋 <b>درخواست‌های اخیرِ شما</b>', ''];
    for (const row of rows) {
      const review = row.meta?.review as
        | { status?: string; note?: string }
        | undefined;
      const when = row.submittedAt ?? row.createdAt;
      const date = when ? isoToJalaliText(new Date(when).toISOString()) : '';
      const state = review?.status ? (labels[review.status] ?? review.status) : 'ثبت‌شده';
      lines.push(
        `• <b>${escapeHtml(row.formVersion?.form?.title ?? 'فرم')}</b>${date ? ` — ${date}` : ''}`,
      );
      lines.push(`  ${state}`);
      if (review?.status === 'rejected' && review.note) {
        lines.push(`  یادداشت: ${escapeHtml(review.note)}`);
      }
    }
    return lines.join('\n');
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
  ): Promise<BotReply> {
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
        'اگر تازه استخدام شده‌اید, از واحدِ منابع انسانی بخواهید شماره‌تان را ثبت کند.',
      ].join('\n');
    }

    // پس از اتصال، کیبوردِ پرسنلی را نشان بده تا کارها یک‌لمسی شوند.
    return {
      text: [
        `✅ خوش آمدید <b>${escapeHtml(person.fullName)}</b>.`,
        person.position ? `سمت: ${escapeHtml(person.position)}` : '',
        '',
        'از این پس وضعیتِ درخواست‌هایتان را اینجا دنبال می‌کنید.',
        'از دکمه‌های پایین استفاده کنید.',
      ]
        .filter((line) => line !== '')
        .join('\n'),
      keyboard: STAFF_KEYBOARD,
    };
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
