import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkspaceEntity } from '../database/entities/workspace.entity';
import {
  ResponseEntity,
  ResponseStatus,
} from '../database/entities/response.entity';
import { FormEntity, FormStatus } from '../database/entities/form.entity';
import {
  PublicationEntity,
  PublicationType,
} from '../database/entities/publication.entity';
import { HrService } from '../hr/hr.service';
import { AnnouncementService } from './announcement.service';
import { BotFormFillService, isBotFillable } from './bot-form-fill.service';
import { isoToJalaliText } from '../common/jalali';
import { CmmsService } from '../cmms/cmms.service';
import { LetterService } from '../letters/letter.service';
import { BotFlowService } from './bot-flow.service';
import { LeaveService } from '../hr/leave.service';
import { BotFlow } from '../database/entities/bot-flow-session.entity';
import { ShiftService, shiftDate, todayIso } from '../hr/shift.service';
import { WorkOrderStatus } from '../database/entities/work-order.entity';
import { MaintenancePriority } from '../database/entities/maintenance-request.entity';
import type { TelegramIntegrationEntity } from '../database/entities/telegram-integration.entity';

/** عمرِ توکنِ هویتِ مینی‌اپ (ثانیه)؛ با توکنِ پاسخ‌دهنده هم‌تراز. */
const BOT_FORM_TOKEN_TTL = Number(
  process.env.RESPONDENT_TOKEN_TTL_SECONDS ?? 2 * 60 * 60,
);

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
const BTN_FORMS = '📝 فرم‌ها';
const BTN_ME = '👤 پرونده‌ی من';
const BTN_LOGOUT = '🚪 خروج';
const BTN_BACK = '↩️ بازگشت';
/** پیشوندِ دکمه‌ی «این فرم را همین‌جا پر کن». */
const BTN_FILL_PREFIX = '▶️ ';

const BTN_TASKS = '🔧 کارهای من';
const BTN_SHIFT = '🗓 شیفتِ من';
const BTN_IN = '🟢 ثبتِ ورود';
const BTN_OUT = '🔴 ثبتِ خروج';
/** پیشوندهای اقدام روی یک دستورِ کار؛ شمارهٔ کار داخلِ خودِ دکمه است. */
const BTN_START_PREFIX = '🚀 ';
const BTN_DONE_PREFIX = '✅ ';

const BTN_LETTERS = '✉️ نامه‌های من';
const BTN_FAULT = '🛠 اعلامِ خرابی';
const BTN_LEAVE = '🌴 درخواستِ مرخصی';
/** «📬 L-00012» یعنی همان نامه را باز کن؛ «↩️ L-00012» یعنی پاسخ بده. */
const BTN_OPEN_LETTER_PREFIX = '📬 ';
const BTN_REPLY_LETTER_PREFIX = '↩️ ';

/** حداکثرِ ردیفِ «📋 درخواست‌های من»؛ پیامِ ربات باید روی گوشی خوانا بماند. */
const MY_REQUESTS_LIMIT = 8;

const FAULT_STATUS: Record<string, string> = {
  new: '🆕 ثبت‌شده',
  under_review: '🔎 در بررسی',
  approved: '👍 تأییدشده',
  assigned: '👷 واگذار شد',
  in_progress: '🔧 در حالِ انجام',
  waiting_parts: '📦 منتظرِ قطعه',
  waiting_contractor: '🏗 منتظرِ پیمانکار',
  follow_up: '🔁 پیگیری',
  completed: '✅ انجام شد',
  rejected: '❌ رد شد',
  closed: '📁 بسته شد',
};

const LEAVE_STATUS: Record<string, string> = {
  pending: '⏳ در انتظارِ تأیید',
  approved: '✅ تأیید شد',
  rejected: '❌ رد شد',
  cancelled: '↩️ لغو شد',
};

/** همان برچسب‌های قبلیِ درخواستِ فرمی؛ متنی که کارمند می‌شناسد عوض نمی‌شود. */
const REVIEW_STATUS: Record<string, string> = {
  pending: '⏳ در انتظار تأیید',
  approved: '✅ تأییدشده',
  rejected: '❌ ردشده',
};

/** «۱۴۰۴/۰۵/۱۲» از تاریخِ ISO یا Date؛ نامعتبر → خالی. */
function jalaliOf(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : isoToJalaliText(d.toISOString());
}

function dateSuffix(value: string | Date | null | undefined): string {
  const text = jalaliOf(value);
  return text ? ` — ${text}` : '';
}

/** برچسبِ فارسیِ وضعیتِ دستورِ کار، برای متنِ ربات. */
const WORK_ORDER_LABELS: Record<string, string> = {
  draft: 'بی‌متصدی',
  assigned: 'ارجاع‌شده به شما',
  in_progress: 'در حالِ انجام',
  waiting_parts: 'منتظرِ قطعه',
  waiting_contractor: 'منتظرِ پیمانکار',
  completed: 'تکمیل‌شده، منتظرِ تأیید',
  verified: 'تأییدشده',
  closed: 'بسته',
  cancelled: 'لغوشده',
};

/** کیبوردِ انتخابِ نوعِ کاربر هنگامِ شروع (برای کسی که هنوز وصل نیست). */
const TYPE_KEYBOARD = {
  keyboard: [[{ text: BTN_STAFF }], [{ text: BTN_MANAGER }]],
  resize_keyboard: true,
};

/** کیبوردِ پرسنلِ وصل‌شده. */
const STAFF_KEYBOARD = {
  keyboard: [
    [{ text: BTN_TASKS }, { text: BTN_LETTERS }],
    [{ text: BTN_IN }, { text: BTN_OUT }],
    [{ text: BTN_FAULT }, { text: BTN_LEAVE }],
    [{ text: BTN_SHIFT }, { text: BTN_FORMS }],
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
    @InjectRepository(FormEntity)
    private readonly forms: Repository<FormEntity>,
    @InjectRepository(PublicationEntity)
    private readonly publications: Repository<PublicationEntity>,
    private readonly jwt: JwtService,
    private readonly fill: BotFormFillService,
    /*
     * کارهای سپرده‌شده و برنامهٔ شیفت از همان سرویس‌هایی می‌آیند که پنل
     * استفاده می‌کند، نه از کوئریِ موازی؛ پس قاعده‌ی گذارِ وضعیت و دامنهٔ
     * سازمان یکی می‌ماند.
     */
    private readonly cmms: CmmsService,
    private readonly shifts: ShiftService,
    private readonly letters: LetterService,
    /*
     * کارهای چندمرحله‌ای (خرابی، مرخصی، پاسخِ نامه) حالتِ خودشان را
     * دارند و از همان سرویس‌های پنل ثبت می‌شوند.
     */
    private readonly flow: BotFlowService,
    /** مرخصی‌های خودِ پرسنل در «📋 درخواست‌های من». */
    private readonly leaves: LeaveService,
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
     * گفتگوی نیمه‌کاره‌ی پر کردنِ فرم بر همه‌چیز مقدم است: وقتی ربات منتظرِ
     * پاسخِ یک سوال است، پیامِ کاربر پاسخ است نه فرمانِ منو. خودِ سرویس
     * «لغو» را می‌شناسد و با پایانِ فرم گفتگو را می‌بندد.
     */
    const inFill = await this.fill.handleMessage(chatId, bot.platform, trimmed);
    if (inFill) return inFill;

    /*
     * کارِ چندمرحله‌ایِ نیمه‌کاره هم بر منو مقدم است: وقتی ربات منتظرِ
     * «تا چه تاریخی؟» است، پیامِ کاربر پاسخ است نه فرمانِ منو.
     */
    const inFlow = await this.flow.handleMessage(chatId, bot.platform, trimmed);
    if (inFlow) return inFlow;

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

    if (
      command === '/فرم‌ها' ||
      command === '/فرمها' ||
      command === '/forms' ||
      trimmed === BTN_FORMS
    ) {
      return this.botForms(bot, chatId);
    }
    if (trimmed === BTN_BACK) {
      const who = await this.hr.findByChat(chatId, bot.platform);
      return who
        ? { text: this.menuText(who), keyboard: STAFF_KEYBOARD }
        : 'شما هنوز وصل نشده‌اید. شماره موبایلِ خود را همین‌جا بفرستید.';
    }
    // «▶️ نامِ فرم» یعنی شروعِ پر کردنِ همان فرم داخلِ گفتگو.
    if (trimmed.startsWith(BTN_FILL_PREFIX)) {
      const started = await this.startFillByTitle(
        bot,
        chatId,
        trimmed.slice(BTN_FILL_PREFIX.length).trim(),
      );
      if (started) return started;
      return 'این فرم دیگر در دسترس نیست. دوباره «📝 فرم‌ها» را بزنید.';
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
    if (
      command === '/کارها' ||
      command === '/tasks' ||
      trimmed === BTN_TASKS
    ) {
      return this.myTasks(bot, chatId);
    }
    if (
      command === '/شیفت' ||
      command === '/shift' ||
      trimmed === BTN_SHIFT
    ) {
      return this.myShift(bot, chatId);
    }
    if (trimmed === BTN_IN || command === '/ورود') {
      return this.punch(bot, chatId, 'in');
    }
    if (trimmed === BTN_OUT || command === '/خروج-کار') {
      return this.punch(bot, chatId, 'out');
    }
    // «🚀 WO-00012» و «✅ WO-00012» یعنی اقدام روی همان دستورِ کار.
    if (
      trimmed.startsWith(BTN_START_PREFIX) ||
      trimmed.startsWith(BTN_DONE_PREFIX)
    ) {
      const start = trimmed.startsWith(BTN_START_PREFIX);
      const number = trimmed
        .slice((start ? BTN_START_PREFIX : BTN_DONE_PREFIX).length)
        .trim();
      return this.advanceTask(bot, chatId, number, start);
    }
    if (
      command === '/نامه' ||
      command === '/letters' ||
      trimmed === BTN_LETTERS
    ) {
      return this.myLetters(bot, chatId);
    }
    if (trimmed === BTN_FAULT || command === '/خرابی') {
      return this.startFlow(bot, chatId, BotFlow.FAULT);
    }
    if (trimmed === BTN_LEAVE || command === '/مرخصی') {
      return this.startFlow(bot, chatId, BotFlow.LEAVE);
    }
    if (trimmed.startsWith(BTN_OPEN_LETTER_PREFIX)) {
      return this.openLetter(
        bot,
        chatId,
        trimmed.slice(BTN_OPEN_LETTER_PREFIX.length).trim(),
      );
    }
    if (trimmed.startsWith(BTN_REPLY_LETTER_PREFIX)) {
      return this.replyToLetter(
        bot,
        chatId,
        trimmed.slice(BTN_REPLY_LETTER_PREFIX.length).trim(),
      );
    }
    if (looksLikeMobile(trimmed)) {
      return this.link(bot, chatId, trimmed);
    }
    return null;
  }

  /** پرسنلِ وصل‌شده و سازمانش، یا پیامِ راهنما. */
  private async whoAmI(
    bot: TelegramIntegrationEntity,
    chatId: string,
  ): Promise<
    | { ok: true; personnelId: string; organizationId: string }
    | { ok: false; reply: BotReply }
  > {
    const person = await this.hr.findByChat(chatId, bot.platform);
    if (!person) {
      return {
        ok: false,
        reply:
          'شما هنوز وصل نشده‌اید. شماره موبایلِ خود را همین‌جا بفرستید یا از «داشبورد من» در پنل کدِ اتصال بگیرید.',
      };
    }
    const organizationId = await this.orgIdOf(bot);
    if (!organizationId) {
      return { ok: false, reply: 'ربات به سازمانی وصل نیست.' };
    }
    return { ok: true, personnelId: person.id, organizationId };
  }

  /**
   * «✉️ نامه‌های من»: نخوانده‌ها اول.
   *
   * هر نامه دکمه‌ی باز کردن می‌گیرد. نامهٔ **تازه** از ربات نوشته نمی‌شود:
   * انتخابِ گیرنده از بینِ ده‌ها همکار با کیبوردِ پاسخ غیرقابلِ استفاده
   * است، پس آن یکی در پنل («داشبورد من») انجام می‌شود. پاسخ به نامهٔ
   * دریافتی اما کامل در گفتگو کار می‌کند، چون گیرنده از پیش معلوم است.
   */
  private async myLetters(
    bot: TelegramIntegrationEntity,
    chatId: string,
  ): Promise<BotReply> {
    const who = await this.whoAmI(bot, chatId);
    if (!who.ok) return who.reply;

    const inbox = await this.letters.inbox(who.organizationId, who.personnelId, {
      pageSize: 8,
    });
    if (inbox.total === 0) {
      return { text: '✉️ نامه‌ای ندارید.', keyboard: STAFF_KEYBOARD };
    }

    const unread = inbox.rows.filter((l) => l.isUnread).length;
    const lines = [
      `✉️ <b>نامه‌های شما</b>${unread > 0 ? ` — ${unread} نخوانده` : ''}`,
      '',
    ];
    const rows: Array<Array<{ text: string }>> = [];
    for (const letter of inbox.rows) {
      lines.push(
        `${letter.isUnread ? '🔵' : '⚪️'} <b>${letter.number}</b> — ${escapeHtml(
          letter.subject,
        )}`,
        `  از: ${escapeHtml(letter.senderName)}${
          letter.priority === 'urgent' ? ' · فوری' : ''
        }`,
      );
      rows.push([{ text: `${BTN_OPEN_LETTER_PREFIX}${letter.number}` }]);
    }
    lines.push('', 'نامهٔ تازه را از «داشبورد من» در پنل بنویسید.');
    rows.push([{ text: BTN_BACK }]);
    return {
      text: lines.join('\n'),
      keyboard: { keyboard: rows, resize_keyboard: true },
    };
  }

  /** یک نامه را نشان می‌دهد، خوانده‌اش می‌کند و دکمهٔ پاسخ می‌دهد. */
  private async openLetter(
    bot: TelegramIntegrationEntity,
    chatId: string,
    number: string,
  ): Promise<BotReply> {
    const who = await this.whoAmI(bot, chatId);
    if (!who.ok) return who.reply;

    const found = await this.letterByNumber(
      who.organizationId,
      who.personnelId,
      number,
    );
    if (!found) {
      return 'این نامه پیدا نشد. «✉️ نامه‌های من» را بزنید.';
    }

    // باز کردن یعنی خواندن؛ همان کاری که پنل هم می‌کند.
    await this.letters
      .markRead(who.organizationId, found.id, who.personnelId)
      .catch(() => undefined);

    const text = [
      `✉️ <b>${found.number}</b> — ${escapeHtml(found.subject)}`,
      `از: ${escapeHtml(found.senderName)}`,
      '',
      escapeHtml(found.body || '—'),
    ].join('\n');
    return {
      text,
      keyboard: {
        keyboard: [
          [{ text: `${BTN_REPLY_LETTER_PREFIX}${found.number}` }],
          [{ text: BTN_LETTERS }, { text: BTN_BACK }],
        ],
        resize_keyboard: true,
      },
    };
  }

  /** پاسخ به نامه را شروع می‌کند (گیرنده از خودِ نامه می‌آید). */
  private async replyToLetter(
    bot: TelegramIntegrationEntity,
    chatId: string,
    number: string,
  ): Promise<BotReply> {
    const who = await this.whoAmI(bot, chatId);
    if (!who.ok) return who.reply;

    const found = await this.letterByNumber(
      who.organizationId,
      who.personnelId,
      number,
    );
    if (!found) return 'این نامه پیدا نشد.';

    await this.fill.cancel?.(chatId, bot.platform);
    return this.flow.start({
      organizationId: who.organizationId,
      personnelId: who.personnelId,
      chatId,
      platform: bot.platform,
      flow: BotFlow.LETTER_REPLY,
      contextId: found.id,
    });
  }

  /** نامه‌ای از صندوقِ خودم با شمارهٔ خوانا. */
  private async letterByNumber(
    organizationId: string,
    personnelId: string,
    number: string,
  ) {
    const page = await this.letters.inbox(organizationId, personnelId, {
      search: number,
      pageSize: 5,
    });
    return page.rows.find((l) => l.number === number) ?? null;
  }

  /** شروعِ یک کارِ چندمرحله‌ای، با بستنِ فرمِ نیمه‌کاره‌ی احتمالی. */
  private async startFlow(
    bot: TelegramIntegrationEntity,
    chatId: string,
    flow: BotFlow,
  ): Promise<BotReply> {
    const who = await this.whoAmI(bot, chatId);
    if (!who.ok) return who.reply;

    /*
     * فرمِ نیمه‌کاره بسته می‌شود.
     *
     * وگرنه هر دو باز می‌ماندند و چون فرم در اولویتِ dispatch است، پاسخِ
     * کاربر به پرسشِ این کار، جوابِ سوالِ فرم شمرده می‌شد.
     */
    await this.fill.cancel?.(chatId, bot.platform);
    return this.flow.start({
      organizationId: who.organizationId,
      personnelId: who.personnelId,
      chatId,
      platform: bot.platform,
      flow,
    });
  }

  /**
   * «🔧 کارهای من»: دستورِ کارهای بازِ سپرده‌شده به همین پرسنل.
   *
   * هر کارِ قابلِ‌اقدام دکمه‌ی خودش را می‌گیرد، پس تکنسین بدونِ باز کردنِ
   * پنل کار را شروع یا تکمیل می‌کند. وبهوک فقط رویدادِ `message` می‌گیرد،
   * پس اقدام با کیبوردِ پاسخ است نه دکمه‌ی شیشه‌ای.
   */
  private async myTasks(
    bot: TelegramIntegrationEntity,
    chatId: string,
  ): Promise<BotReply> {
    const person = await this.hr.findByChat(chatId, bot.platform);
    if (!person) {
      return 'شما هنوز وصل نشده‌اید. شماره موبایلِ خود را همین‌جا بفرستید.';
    }
    const organizationId = await this.orgIdOf(bot);
    if (!organizationId) return 'ربات به سازمانی وصل نیست.';

    const orders = await this.cmms.workOrdersOfTechnician(
      organizationId,
      person.id,
    );
    if (orders.length === 0) {
      return {
        text: '✅ کارِ بازی به شما سپرده نشده است.',
        keyboard: STAFF_KEYBOARD,
      };
    }

    const today = todayIso();
    const lines = ['🔧 <b>کارهای شما</b>', ''];
    const rows: Array<Array<{ text: string }>> = [];

    for (const o of orders) {
      const late = o.dueDate && o.dueDate < today;
      const marks = [
        o.priority === MaintenancePriority.EMERGENCY ? '🚨 اضطراری' : '',
        late ? '⏰ عقب‌افتاده' : '',
      ].filter(Boolean);
      lines.push(
        `• <b>${o.number}</b> — ${escapeHtml(o.title)}`,
        `  وضعیت: ${WORK_ORDER_LABELS[o.status] ?? o.status}${
          o.dueDate ? ` · موعد: ${isoToJalaliText(o.dueDate)}` : ''
        }${marks.length > 0 ? ` · ${marks.join(' · ')}` : ''}`,
      );

      if (o.status === WorkOrderStatus.ASSIGNED) {
        rows.push([{ text: `${BTN_START_PREFIX}${o.number}` }]);
      } else if (o.status === WorkOrderStatus.IN_PROGRESS) {
        rows.push([{ text: `${BTN_DONE_PREFIX}${o.number}` }]);
      }
    }

    lines.push('', 'دکمهٔ هر کار، آن را شروع یا تکمیل می‌کند.');
    rows.push([{ text: BTN_BACK }]);
    return {
      text: lines.join('\n'),
      keyboard: { keyboard: rows, resize_keyboard: true },
    };
  }

  /**
   * شروع یا تکمیلِ یک کار از داخلِ ربات.
   *
   * گذار از همان `CmmsService` می‌رود، پس قاعده‌ی وضعیت (و همگامیِ آمادگیِ
   * اتاق) همان چیزی است که در پنل اعمال می‌شود. کارِ سپرده‌نشده به این
   * پرسنل پذیرفته نمی‌شود.
   */
  private async advanceTask(
    bot: TelegramIntegrationEntity,
    chatId: string,
    number: string,
    start: boolean,
  ): Promise<BotReply> {
    const person = await this.hr.findByChat(chatId, bot.platform);
    if (!person) return 'شما هنوز وصل نشده‌اید.';
    const organizationId = await this.orgIdOf(bot);
    if (!organizationId) return 'ربات به سازمانی وصل نیست.';

    const mine = await this.cmms.workOrdersOfTechnician(
      organizationId,
      person.id,
      { limit: 50 },
    );
    const order = mine.find((o) => o.number === number);
    if (!order) {
      return 'این کار به شما سپرده نشده یا بسته شده است. «🔧 کارهای من» را بزنید.';
    }

    try {
      await this.cmms.changeWorkOrderStatus(
        organizationId,
        order.id,
        start ? WorkOrderStatus.IN_PROGRESS : WorkOrderStatus.COMPLETED,
        { note: 'از ربات', actorId: undefined },
      );
    } catch (error) {
      const message =
        (error as { response?: { message?: string } })?.response?.message ??
        (error as Error).message;
      return `❌ ${message}`;
    }

    const headline = start
      ? `🚀 کارِ ${order.number} شروع شد.`
      : `✅ کارِ ${order.number} تکمیل شد و برای تأییدِ مدیر رفت.`;
    const rest = await this.myTasks(bot, chatId);
    const restText = typeof rest === 'string' ? rest : rest.text;
    return {
      text: `${headline}\n\n${restText}`,
      keyboard: typeof rest === 'string' ? STAFF_KEYBOARD : rest.keyboard,
    };
  }

  /** «🗓 شیفتِ من»: برنامهٔ هفتهٔ پیشِ‌رو. */
  private async myShift(
    bot: TelegramIntegrationEntity,
    chatId: string,
  ): Promise<BotReply> {
    const person = await this.hr.findByChat(chatId, bot.platform);
    if (!person) {
      return 'شما هنوز وصل نشده‌اید. شماره موبایلِ خود را همین‌جا بفرستید.';
    }

    const today = todayIso();
    const rows = await this.shifts.myShifts(
      person.id,
      today,
      shiftDate(today, 6),
    );
    if (rows.length === 0) {
      return {
        text: 'برنامهٔ شیفتی برای هفتهٔ پیشِ‌رو برای شما ثبت نشده است.',
        keyboard: STAFF_KEYBOARD,
      };
    }

    const lines = ['🗓 <b>برنامهٔ شیفتِ شما</b>', ''];
    for (const s of rows) {
      const when = s.date === today ? 'امروز' : isoToJalaliText(s.date);
      lines.push(
        `• ${when} — ${s.startTime} تا ${s.endTime}${
          s.label ? ` (${escapeHtml(s.label)})` : ''
        }${s.note ? `\n  ${escapeHtml(s.note)}` : ''}`,
      );
    }
    return { text: lines.join('\n'), keyboard: STAFF_KEYBOARD };
  }

  /** ثبتِ ورود/خروجِ خودِ پرسنل از ربات. */
  private async punch(
    bot: TelegramIntegrationEntity,
    chatId: string,
    kind: 'in' | 'out',
  ): Promise<BotReply> {
    const person = await this.hr.findByChat(chatId, bot.platform);
    if (!person) {
      return 'شما هنوز وصل نشده‌اید. شماره موبایلِ خود را همین‌جا بفرستید.';
    }
    const organizationId = await this.orgIdOf(bot);
    if (!organizationId) return 'ربات به سازمانی وصل نیست.';

    try {
      const record = await this.shifts.botPunch(
        organizationId,
        person.id,
        kind,
      );
      const text =
        kind === 'in'
          ? [
              `🟢 ورودِ شما ساعتِ ${record.checkIn} ثبت شد.`,
              record.status === 'late'
                ? '⚠️ این ورود با تأخیر ثبت شد.'
                : '',
            ]
              .filter(Boolean)
              .join('\n')
          : [
              `🔴 خروجِ شما ساعتِ ${record.checkOut} ثبت شد.`,
              `کارکردِ امروز: ${Math.floor(record.minutesWorked / 60)} ساعت و ${
                record.minutesWorked % 60
              } دقیقه.`,
            ].join('\n');
      return { text, keyboard: STAFF_KEYBOARD };
    } catch (error) {
      const message =
        (error as { response?: { message?: string } })?.response?.message ??
        (error as Error).message;
      return { text: `❌ ${message}`, keyboard: STAFF_KEYBOARD };
    }
  }

  /**
   * منوی پرسنل، اگر این گفتگو به پرونده‌ای وصل باشد؛ وگرنه `null`.
   *
   * پاسخِ پیامِ ناشناختهٔ یک کارمند است. پیش از این، چنین پیامی به
   * «راهنمای مدیریت» می‌رسید: هم برای کارمند بی‌معنا بود و هم امکاناتِ
   * مدیریتی را جلوی کسی می‌گذاشت که به آن‌ها کاری ندارد.
   */
  async menuIfLinked(
    bot: TelegramIntegrationEntity,
    chatId: string,
  ): Promise<BotReply | null> {
    const person = await this.hr.findByChat(chatId, bot.platform);
    if (!person) return null;
    return {
      text: ['این پیام را نشناختم.', '', this.menuText(person)].join('\n'),
      keyboard: STAFF_KEYBOARD,
    };
  }

  /** متنِ منوی پرسنلِ وصل‌شده. */
  private menuText(person: { fullName: string; position?: string | null }): string {
    return [
      `👤 <b>${escapeHtml(person.fullName)}</b> خوش آمدید.`,
      person.position ? `سمت: ${escapeHtml(person.position)}` : '',
      '',
      'از دکمه‌های پایین استفاده کنید یا فرمان بزنید:',
      'کارهای من · نامه‌های من · شیفتِ من · ثبتِ ورود/خروج',
      'اعلامِ خرابی · درخواستِ مرخصی',
      'فرم‌ها · درخواست‌های من · اطلاعیه‌ها · پرونده‌ی من · خروج',
    ]
      .filter((l) => l !== '')
      .join('\n');
  }

  /**
   * «📝 فرم‌ها» (فاز مینی‌اپ): فرم‌هایی که در پنل برای ربات منتشر شده‌اند
   * (settings.botPublish) و به سازمان/بخشِ همین پرسنل مربوط‌اند، با دکمه‌ی
   * مینی‌اپِ بله باز می‌شوند تا پرسنل گزارش/درخواست را از داخلِ ربات پر کند.
   *
   * هر لینک توکنِ هویت دارد (موبایلِ پرسنل = کلیدِ پاسخ‌دهنده) تا پاسخ به‌نامِ
   * خودش در «درخواست‌های من» و گردش‌کار بنشیند، بدونِ ورودِ دوباره.
   */
  private async botForms(
    bot: TelegramIntegrationEntity,
    chatId: string,
  ): Promise<BotReply> {
    const person = await this.hr.findByChat(chatId, bot.platform);
    if (!person) {
      return 'شما هنوز وصل نشده‌اید. شماره موبایلِ خود را همین‌جا بفرستید.';
    }

    const base = (process.env.PUBLIC_URL ?? '').replace(/\/+$/, '');
    if (!base) {
      return 'لینکِ فرم‌ها هنوز پیکربندی نشده است؛ با مدیر سامانه تماس بگیرید.';
    }

    // فرم‌های فعالِ همین سازمان (از طریقِ فضای کاری)؛ انتشار در ربات و تطبیقِ
    // بخش در حافظه بررسی می‌شود تا کوئریِ JSON به گویشِ دیتابیس وابسته نشود.
    const candidates = await this.forms
      .createQueryBuilder('form')
      .innerJoin('form.workspace', 'workspace')
      .where('workspace.organizationId = :org', {
        org: person.organizationId,
      })
      .andWhere('form.status = :status', { status: FormStatus.ACTIVE })
      .orderBy('form.createdAt', 'DESC')
      .getMany();
    const published = candidates.filter((form) => {
      const on = (form.settings as { botPublish?: unknown })?.botPublish === true;
      const dept = form.departmentId;
      const forMe = !dept || dept === person.departmentId;
      return on && forMe;
    });

    if (published.length === 0) {
      return 'فعلاً فرمی برای شما در ربات منتشر نشده است.';
    }

    const inBot: Array<Array<{ text: string }>> = [];
    const lines = ['📝 <b>فرم‌های شما</b>', ''];
    let any = false;
    for (const form of published) {
      const pub = await this.publications.findOne({
        where: { formId: form.id, type: PublicationType.LINK, isActive: true },
      });
      if (!pub) continue; // منتشرشده ولی لینکِ عمومی ندارد؛ از فهرست کنار می‌رود.
      any = true;

      /*
       * اگر همه‌ی فیلدهای فرم با پیام/دکمه قابل پاسخ‌اند و فرم منطقِ شرطی
       * ندارد، کلاً داخلِ خودِ ربات پر می‌شود و نیازی به باز کردنِ مینی‌اپ
       * نیست. وگرنه (آپلود، امضا، موقعیت، ماتریس و …) لینکِ مینی‌اپ می‌دهیم.
       */
      const { questions, logic } = await this.fill.structureOf(form.id);
      if (isBotFillable(questions, logic)) {
        lines.push(`• <b>${escapeHtml(form.title)}</b> — همین‌جا پر می‌شود`);
        inBot.push([{ text: `${BTN_FILL_PREFIX}${form.title}`.slice(0, 60) }]);
      } else {
        const token = this.jwt.sign(
          {
            publicationId: pub.id,
            respondentKey: person.mobile ?? '',
            mode: 'bot',
          },
          { expiresIn: BOT_FORM_TOKEN_TTL },
        );
        // قطعه‌ی آدرس (#rt=) توکن را حمل می‌کند؛ به سرور/لاگ نمی‌رود.
        const url = `${base}/f/${pub.slug ?? pub.token}#rt=${token}`;
        lines.push(`• <b>${escapeHtml(form.title)}</b> — با لینکِ زیر:`);
        lines.push(url);
      }
      lines.push('');
    }

    if (!any) {
      return 'فعلاً فرمی برای شما در ربات منتشر نشده است.';
    }

    if (inBot.length > 0) {
      lines.push('برای شروع، نامِ فرم را از دکمه‌های پایین بزنید.');
      inBot.push([{ text: BTN_BACK }]);
      return {
        text: lines.join('\n').trim(),
        keyboard: { keyboard: inBot, resize_keyboard: true },
      };
    }
    return { text: lines.join('\n').trim(), keyboard: STAFF_KEYBOARD };
  }

  /**
   * کاربر نامِ یکی از فرم‌های قابلِ پر شدن در گفتگو را زده است.
   *
   * `null` یعنی این متن نامِ فرم نبود و باید به بقیه‌ی منو برود.
   */
  private async startFillByTitle(
    bot: TelegramIntegrationEntity,
    chatId: string,
    title: string,
  ): Promise<BotReply | null> {
    const person = await this.hr.findByChat(chatId, bot.platform);
    if (!person) return null;

    const candidates = await this.forms
      .createQueryBuilder('form')
      .innerJoin('form.workspace', 'workspace')
      .where('workspace.organizationId = :org', { org: person.organizationId })
      .andWhere('form.status = :status', { status: FormStatus.ACTIVE })
      .andWhere('form.title = :title', { title })
      .getMany();

    for (const form of candidates) {
      const on =
        (form.settings as { botPublish?: unknown })?.botPublish === true;
      const dept = form.departmentId;
      if (!on || (dept && dept !== person.departmentId)) continue;

      const pub = await this.publications.findOne({
        where: { formId: form.id, type: PublicationType.LINK, isActive: true },
      });
      if (!pub) continue;

      const { questions, logic } = await this.fill.structureOf(form.id);
      if (!isBotFillable(questions, logic)) continue;

      return this.fill.start({
        chatId,
        platform: bot.platform,
        formId: form.id,
        publicationId: pub.id,
        respondentKey: person.mobile ?? '',
        formTitle: form.title,
      });
    }
    return null;
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

    /*
     * سه منبع، یک فهرست: خرابی‌هایی که اعلام کرده، مرخصی‌هایش، و
     * درخواست‌هایی که با فرم ثبت کرده. پیش از این فقط پاسخِ فرم (با موبایل)
     * دیده می‌شد؛ خرابی و مرخصیِ ثبت‌شده از خودِ ربات هیچ‌جا نمی‌آمد، با اینکه
     * پیامِ ثبت می‌گفت از همین‌جا دنبالشان کنید.
     */
    const [faults, leaves, forms] = await Promise.all([
      this.cmms
        .listRequests(person.organizationId, {
          requestedByPersonnelId: person.id,
          pageSize: MY_REQUESTS_LIMIT,
        })
        .then((page) => page.rows)
        .catch(() => []),
      this.leaves
        .list(person.organizationId, {
          personnelId: person.id,
          pageSize: MY_REQUESTS_LIMIT,
        })
        .then((page) => page.rows)
        .catch(() => []),
      person.mobile ? this.formRequests(person) : Promise.resolve([]),
    ]);

    const items: Array<{ at: number; lines: string[] }> = [];
    for (const f of faults) {
      items.push({
        at: new Date(f.createdAt).getTime(),
        lines: [
          `🛠 <b>${escapeHtml(f.number)}</b> — ${escapeHtml(f.title)}${dateSuffix(f.createdAt)}`,
          `  ${FAULT_STATUS[f.status] ?? f.status}`,
        ],
      });
    }
    for (const l of leaves) {
      items.push({
        at: new Date(l.createdAt).getTime(),
        lines: [
          `🌴 <b>${escapeHtml(l.number)}</b> — مرخصی ${jalaliOf(l.fromDate)}${
            l.toDate && l.toDate !== l.fromDate ? ` تا ${jalaliOf(l.toDate)}` : ''
          }`,
          `  ${LEAVE_STATUS[l.status] ?? l.status}`,
          ...(l.status === 'rejected' && l.decisionNote
            ? [`  یادداشت: ${escapeHtml(l.decisionNote)}`]
            : []),
        ],
      });
    }
    for (const r of forms) {
      const review = r.meta?.review as
        | { status?: string; note?: string }
        | undefined;
      const when = r.submittedAt ?? r.createdAt;
      items.push({
        at: new Date(when).getTime(),
        lines: [
          `📝 <b>${escapeHtml(r.formVersion?.form?.title ?? 'فرم')}</b>${dateSuffix(when)}`,
          `  ${review?.status ? (REVIEW_STATUS[review.status] ?? review.status) : 'ثبت‌شده'}`,
          ...(review?.status === 'rejected' && review.note
            ? [`  یادداشت: ${escapeHtml(review.note)}`]
            : []),
        ],
      });
    }

    if (items.length === 0) return 'درخواستی از شما ثبت نشده است.';

    items.sort((a, b) => b.at - a.at);
    const lines = ['📋 <b>درخواست‌های اخیرِ شما</b>', ''];
    for (const item of items.slice(0, MY_REQUESTS_LIMIT)) {
      lines.push(...item.lines);
    }
    return lines.join('\n');
  }

  /** درخواست‌هایی که با فرم (و موبایلِ پرونده) ثبت شده‌اند. */
  private formRequests(person: { mobile: string; organizationId: string }) {
    return this.responses
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
      .take(MY_REQUESTS_LIMIT)
      .getMany();
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
