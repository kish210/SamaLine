import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BotFlow,
  BotFlowSessionEntity,
} from '../database/entities/bot-flow-session.entity';
import {
  MaintenanceCategory,
  MaintenancePriority,
} from '../database/entities/maintenance-request.entity';
import { LeaveType } from '../database/entities/leave-request.entity';
import { CmmsService } from '../cmms/cmms.service';
import { LeaveService } from '../hr/leave.service';
import { LetterService } from '../letters/letter.service';
import { jalaliToIso } from '../common/jalali';

/** پاسخِ ربات: متن + کیبوردِ اختیاری (هم‌شکلِ BotReply در staff-bot). */
interface Reply {
  text: string;
  keyboard?: Record<string, unknown>;
}

const BTN_CANCEL = '✖️ لغو';
const BTN_SKIP = '⏭ رد کردن';

/** اولویت‌ها و دسته‌ها با برچسبِ فارسی، برای دکمه‌ها. */
const PRIORITIES: Array<[string, MaintenancePriority]> = [
  ['کم', MaintenancePriority.LOW],
  ['عادی', MaintenancePriority.NORMAL],
  ['زیاد', MaintenancePriority.HIGH],
  ['اضطراری', MaintenancePriority.EMERGENCY],
];

const LEAVE_TYPES: Array<[string, LeaveType]> = [
  ['استحقاقی', LeaveType.ANNUAL],
  ['استعلاجی', LeaveType.SICK],
  ['بی‌حقوق', LeaveType.UNPAID],
  ['مأموریت', LeaveType.MISSION],
  ['ساعتی', LeaveType.HOURLY],
  ['سایر', LeaveType.OTHER],
];

/** ارقامِ فارسی/عربی را به لاتین برمی‌گرداند. */
function toLatinDigits(input: string): string {
  return input.replace(/[۰-۹٠-٩]/g, (d) =>
    String(
      d.charCodeAt(0) >= 0x06f0
        ? d.charCodeAt(0) - 0x06f0
        : d.charCodeAt(0) - 0x0660,
    ),
  );
}

/**
 * تاریخِ ورودیِ کاربر را به ISO میلادی تبدیل می‌کند.
 *
 * کارمند تاریخ را شمسی می‌نویسد («۱۴۰۴/۰۵/۱۲»)؛ سالِ کمتر از ۱۷۰۰ یعنی
 * شمسی. میلادی هم پذیرفته می‌شود تا کسی که عادت دیگری دارد گیر نکند.
 */
export function parseUserDate(raw: string): string | null {
  const parts = toLatinDigits(raw.trim())
    .split(/[/\-.]/)
    .map((p) => p.trim());
  if (parts.length !== 3) return null;
  const [y, m, d] = parts.map(Number);
  if (![y, m, d].every(Number.isFinite)) return null;
  if (y < 1700) {
    try {
      return jalaliToIso(y, m, d);
    } catch {
      return null;
    }
  }
  const date = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

/** کیبوردِ یک قدم: گزینه‌ها دوبه‌دو + لغو. */
function keyboardOf(options: string[], skippable = false) {
  const rows: Array<Array<{ text: string }>> = [];
  for (let i = 0; i < options.length; i += 2) {
    rows.push(options.slice(i, i + 2).map((text) => ({ text })));
  }
  if (skippable) rows.push([{ text: BTN_SKIP }]);
  rows.push([{ text: BTN_CANCEL }]);
  return { keyboard: rows, resize_keyboard: true };
}

/**
 * کارهای چندمرحله‌ایِ کارمند داخلِ گفتگوی ربات.
 *
 * سه کار: اعلامِ خرابی، درخواستِ مرخصی، و پاسخ به نامه. هر سه از همان
 * سرویس‌هایی می‌روند که پنل استفاده می‌کند (`CmmsService`,
 * `LeaveService`, `LetterService`)، پس قاعده‌ها یک جا می‌مانند: مرخصیِ
 * هم‌پوشان همان‌جا رد می‌شود و پاسخِ نامه همان بررسیِ دسترسی را می‌گذراند.
 *
 * وبهوک فقط رویدادِ `message` می‌گیرد (نه callbackِ دکمه‌های شیشه‌ای)، پس
 * همه‌ی گزینه‌ها کیبوردِ پاسخ‌اند.
 */
@Injectable()
export class BotFlowService {
  private readonly logger = new Logger(BotFlowService.name);

  constructor(
    @InjectRepository(BotFlowSessionEntity)
    private readonly sessions: Repository<BotFlowSessionEntity>,
    private readonly cmms: CmmsService,
    private readonly leaves: LeaveService,
    private readonly letters: LetterService,
  ) {}

  findSession(chatId: string, platform: string) {
    return this.sessions.findOne({ where: { chatId, platform } });
  }

  /** بستنِ کارِ نیمه‌کاره (مثلاً وقتی کاربر فرمی را شروع می‌کند). */
  async cancel(chatId: string, platform: string) {
    await this.sessions.delete({ chatId, platform });
  }

  /** شروعِ یک کار؛ اولین پرسش را برمی‌گرداند. */
  async start(input: {
    organizationId: string;
    personnelId: string;
    chatId: string;
    platform: string;
    flow: BotFlow;
    contextId?: string | null;
  }): Promise<Reply> {
    // هر گفتگو یک کارِ نیمه‌کاره دارد؛ شروعِ تازه جایگزینِ قبلی می‌شود.
    await this.sessions.delete({
      chatId: input.chatId,
      platform: input.platform,
    });
    await this.sessions.save(
      this.sessions.create({
        organizationId: input.organizationId,
        personnelId: input.personnelId,
        chatId: input.chatId,
        platform: input.platform,
        flow: input.flow,
        step: 0,
        data: {},
        contextId: input.contextId ?? null,
      }),
    );
    return this.promptFor(input.flow, 0);
  }

  /**
   * پیامِ کاربر را به‌عنوانِ پاسخِ قدمِ جاری می‌گیرد.
   *
   * `null` یعنی این چت کارِ بازی ندارد و پیام باید به منوی عادی برود.
   */
  async handleMessage(
    chatId: string,
    platform: string,
    text: string,
  ): Promise<Reply | null> {
    const session = await this.findSession(chatId, platform);
    if (!session) return null;

    const trimmed = text.trim();
    if (trimmed === BTN_CANCEL || trimmed === '/لغو' || trimmed === '/cancel') {
      await this.sessions.delete({ id: session.id });
      return {
        text: '✖️ لغو شد.',
        keyboard: { remove_keyboard: true },
      };
    }

    const parsed = this.parseStep(session, trimmed);
    if ('error' in parsed) {
      const again = this.promptFor(session.flow, session.step);
      return { text: `${parsed.error}\n\n${again.text}`, keyboard: again.keyboard };
    }

    const data = { ...(session.data ?? {}), ...parsed.patch };
    const nextStep = session.step + 1;

    if (nextStep < this.stepCount(session.flow)) {
      await this.sessions.update(
        { id: session.id },
        { step: nextStep, data: data as never },
      );
      const prompt = this.promptFor(session.flow, nextStep);
      const counter = `قدم ${nextStep + 1} از ${this.stepCount(session.flow)}`;
      return { text: `${counter}\n${prompt.text}`, keyboard: prompt.keyboard };
    }

    // قدمِ آخر: ثبت می‌کنیم و گفتگو را می‌بندیم.
    const done = await this.submit(session, data);
    await this.sessions.delete({ id: session.id });
    return { text: done, keyboard: { remove_keyboard: true } };
  }

  // ── قدم‌ها ────────────────────────────────────────────────────────────

  private stepCount(flow: BotFlow): number {
    if (flow === BotFlow.FAULT) return 3;
    if (flow === BotFlow.LEAVE) return 4;
    return 1;
  }

  private promptFor(flow: BotFlow, step: number): Reply {
    if (flow === BotFlow.FAULT) {
      if (step === 0) {
        return {
          text: '🛠 چه چیزی خراب است؟ (مثلاً: کولرِ اتاق ۲۰۳ کار نمی‌کند)',
          keyboard: keyboardOf([]),
        };
      }
      if (step === 1) {
        return {
          text: 'کجاست؟ (اتاق، طبقه یا بخش)',
          keyboard: keyboardOf([], true),
        };
      }
      return {
        text: 'چقدر فوری است؟',
        keyboard: keyboardOf(PRIORITIES.map(([label]) => label)),
      };
    }

    if (flow === BotFlow.LEAVE) {
      if (step === 0) {
        return {
          text: '🌴 از چه تاریخی؟ (به شکلِ ۱۴۰۴/۰۵/۱۲)',
          keyboard: keyboardOf([]),
        };
      }
      if (step === 1) {
        return {
          text: 'تا چه تاریخی؟ (برای یک روز، همان تاریخ را بزنید)',
          keyboard: keyboardOf([]),
        };
      }
      if (step === 2) {
        return {
          text: 'نوعِ مرخصی؟',
          keyboard: keyboardOf(LEAVE_TYPES.map(([label]) => label)),
        };
      }
      return { text: 'علتِ مرخصی؟', keyboard: keyboardOf([], true) };
    }

    return {
      text: '✉️ پاسخِ خود را بنویسید:',
      keyboard: keyboardOf([]),
    };
  }

  /** پاسخِ کاربر را به دادهٔ قدم تبدیل می‌کند یا خطای فارسی می‌دهد. */
  private parseStep(
    session: BotFlowSessionEntity,
    text: string,
  ): { patch: Record<string, unknown> } | { error: string } {
    const skipped = text === BTN_SKIP;

    if (session.flow === BotFlow.FAULT) {
      if (session.step === 0) {
        if (text.length < 3) return { error: 'کمی روشن‌تر بنویسید.' };
        return { patch: { title: text.slice(0, 200) } };
      }
      if (session.step === 1) {
        return { patch: { location: skipped ? '' : text.slice(0, 160) } };
      }
      const found = PRIORITIES.find(([label]) => label === text);
      if (!found) {
        return { error: 'یکی از گزینه‌های روی کیبورد را بزنید.' };
      }
      return { patch: { priority: found[1] } };
    }

    if (session.flow === BotFlow.LEAVE) {
      if (session.step === 0 || session.step === 1) {
        const iso = parseUserDate(text);
        if (!iso) return { error: 'تاریخ را به شکلِ ۱۴۰۴/۰۵/۱۲ بنویسید.' };
        if (session.step === 1) {
          const from = String(session.data?.fromDate ?? '');
          /*
           * «تا» پیش از «از» بی‌معناست.
           *
           * سرویسِ مرخصی هم صفر روز حساب می‌کرد و درخواستِ بی‌معنا ثبت
           * می‌شد؛ همین‌جا جلویش گرفته می‌شود تا کاربر بفهمد چرا.
           */
          if (from && iso < from) {
            return { error: 'تاریخِ پایان پیش از شروع است.' };
          }
          return { patch: { toDate: iso } };
        }
        return { patch: { fromDate: iso } };
      }
      if (session.step === 2) {
        const found = LEAVE_TYPES.find(([label]) => label === text);
        if (!found) {
          return { error: 'یکی از گزینه‌های روی کیبورد را بزنید.' };
        }
        return { patch: { type: found[1] } };
      }
      return { patch: { reason: skipped ? '' : text.slice(0, 500) } };
    }

    // پاسخِ نامه: فقط متن.
    if (text.length < 2) return { error: 'متنِ پاسخ خالی است.' };
    return { patch: { body: text.slice(0, 4000) } };
  }

  /** ثبتِ نهایی از همان سرویسی که پنل استفاده می‌کند. */
  private async submit(
    session: BotFlowSessionEntity,
    data: Record<string, unknown>,
  ): Promise<string> {
    try {
      if (session.flow === BotFlow.FAULT) {
        const saved = await this.cmms.createRequest(session.organizationId, {
          title: String(data.title ?? ''),
          location: String(data.location ?? ''),
          priority: data.priority as MaintenancePriority,
          category: MaintenanceCategory.OTHER,
          /*
           * گزارش‌دهنده ثبت می‌شود؛ وگرنه خرابی بی‌نام می‌ماند و کارمند در
           * «📋 درخواست‌های من» پیدایش نمی‌کرد، با اینکه پیامِ ثبت همین را
           * می‌گوید. فنی هم می‌داند برای جزئیات سراغِ چه کسی برود.
           */
          requestedByPersonnelId: session.personnelId,
        });
        return [
          `✅ خرابی با شمارهٔ <b>${saved.number}</b> ثبت شد.`,
          'وضعیتش را از «📋 درخواست‌های من» دنبال کنید.',
        ].join('\n');
      }

      if (session.flow === BotFlow.LEAVE) {
        const saved = await this.leaves.create(session.organizationId, {
          personnelId: session.personnelId,
          type: data.type as LeaveType,
          fromDate: String(data.fromDate ?? ''),
          toDate: String(data.toDate ?? ''),
          reason: String(data.reason ?? ''),
        });
        return [
          `✅ درخواستِ مرخصی با شمارهٔ <b>${saved.number}</b> ثبت شد.`,
          `${saved.days} روز، منتظرِ تأییدِ مدیر.`,
          'نتیجه را همین‌جا به شما اطلاع می‌دهیم.',
        ].join('\n');
      }

      const saved = await this.letters.reply(
        session.organizationId,
        session.personnelId,
        String(session.contextId ?? ''),
        { body: String(data.body ?? '') },
      );
      return `✅ پاسخ با شمارهٔ <b>${saved.number}</b> فرستاده شد.`;
    } catch (error) {
      const message =
        (error as { response?: { message?: string } })?.response?.message ??
        (error as Error).message;
      this.logger.warn(
        `ثبتِ «${session.flow}» از ربات ناموفق بود: ${(error as Error).message}`,
      );
      /*
       * دلیلِ واقعی به کاربر گفته می‌شود.
       *
       * «خطایی رخ داد» کارمند را سرگردان می‌کرد؛ «برای این بازه مرخصی
       * ثبت‌شده دارید» قابلِ‌اقدام است.
       */
      return `❌ ثبت نشد: ${Array.isArray(message) ? message.join(' ') : message}`;
    }
  }
}
