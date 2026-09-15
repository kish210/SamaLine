import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Repository } from 'typeorm';
import { ResponseEntity, ResponseStatus } from '../database/entities/response.entity';
import { PublicationEntity } from '../database/entities/publication.entity';
import { FormEntity } from '../database/entities/form.entity';
import { MessagingService } from '../messaging/messaging.service';
import type { MessageChannel } from '../messaging/messaging.types';

/** هر ۱۵ دقیقه یک بار دنبال فرم‌های رهاشده می‌گردد. */
const CHECK_INTERVAL_MS = 15 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/** پیش‌فرض‌ها وقتی فرم فقط «روشن» است و چیز دیگری تنظیم نکرده. */
const DEFAULT_DELAY_HOURS = 6;
/** بعد از این مدت، فرمِ رهاشده آن‌قدر کهنه است که یادآوری بی‌فایده می‌شود. */
const MAX_AGE_HOURS = 72;

interface ReminderSettings {
  enabled: boolean;
  delayHours: number;
  channel: 'auto' | 'sms' | 'email';
  message: string | null;
}

/**
 * یادآوری فرم‌های نیمه‌تمام.
 *
 * پاسخ‌های «partial» از قبل ذخیره می‌شوند (پیشرفتِ ذخیره‌شده‌ی پاسخ‌دهنده). این
 * سرویس آن‌هایی را که مدتی است رها شده‌اند پیدا می‌کند، اگر شماره یا ایمیلی در
 * همان پاسخ ناقص باشد، پیام یادآوری با لینک ادامه می‌فرستد و «یادآوری‌شده»
 * علامتشان می‌زند تا دوباره سراغشان نرود.
 *
 * زمان‌بندی مثل گزارش دوره‌ی تلگرام با یک تایمر ساده است، نه cron: به یک ثانیه
 * دقت لازم نیست و این‌طوری وابستگی و حالت کمتری دارد.
 */
@Injectable()
export class ReminderService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReminderService.name);
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    @InjectRepository(ResponseEntity)
    private readonly responseRepo: Repository<ResponseEntity>,
    @InjectRepository(PublicationEntity)
    private readonly publicationRepo: Repository<PublicationEntity>,
    @InjectRepository(FormEntity)
    private readonly formRepo: Repository<FormEntity>,
    private readonly messaging: MessagingService,
  ) {}

  onModuleInit() {
    /*
     * کلید خاموشِ سراسری.
     *
     * روی نصبی که هنوز درگاه پیامک را تنظیم نکرده، بهتر است این سرویس اصلا
     * بیدار نشود تا هر ۱۵ دقیقه بی‌دلیل کوئری نزند. یادآوری خودش هم فقط برای
     * فرم‌هایی که صریحا روشنش کرده‌اند کار می‌کند، پس این فقط یک لایه‌ی
     * محافظت اضافه است.
     */
    if (process.env.REMINDERS_DISABLED === '1') {
      this.logger.log('یادآوری فرم نیمه‌تمام با REMINDERS_DISABLED خاموش است.');
      return;
    }
    this.timer = setInterval(() => void this.run(), CHECK_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** یک دور بررسی؛ برای تست و اجرای دستی هم قابل صدا زدن است. */
  async run(now = new Date()): Promise<number> {
    let sent = 0;
    try {
      /*
       * فقط پاسخ‌های ناقصی که دست‌کم DEFAULT_DELAY_HOURS از شروعشان گذشته و
       * از MAX_AGE_HOURS کهنه‌تر نشده‌اند. تاخیر واقعیِ هر فرم بعدا و روی همین
       * مجموعه اعمال می‌شود؛ این کوئری فقط دامنه را کوچک می‌کند.
       */
      const candidates = await this.responseRepo.find({
        where: {
          status: ResponseStatus.PARTIAL,
          submittedAt: IsNull(),
          startedAt: LessThan(new Date(now.getTime() - DEFAULT_DELAY_HOURS * HOUR_MS)),
        },
        order: { startedAt: 'ASC' },
        take: 200,
      });

      for (const partial of candidates) {
        if (await this.remindOne(partial, now)) sent += 1;
      }
    } catch (error) {
      this.logger.warn(
        `اجرای یادآوری فرم نیمه‌تمام ناموفق بود: ${(error as Error).message}`,
      );
    }
    return sent;
  }

  /** بررسی و در صورت لزوم ارسال یادآوری برای یک پاسخ ناقص. */
  private async remindOne(
    partial: ResponseEntity,
    now: Date,
  ): Promise<boolean> {
    // یک بار یادآوری کافی است؛ اصرارِ دوباره آزاردهنده است نه کمک‌کننده.
    if (partial.meta?.remindedAt) return false;

    const publication = await this.publicationRepo.findOne({
      where: { id: partial.publicationId },
    });
    if (!publication) return false;

    const form = await this.formRepo.findOne({
      where: { id: publication.formId },
    });
    if (!form) return false;

    const settings = this.readSettings(form.settings);
    if (!settings.enabled) return false;

    const ageHours = (now.getTime() - new Date(partial.startedAt).getTime()) / HOUR_MS;
    if (ageHours < settings.delayHours || ageHours > MAX_AGE_HOURS) return false;

    /*
     * اگر همین پاسخ‌دهنده بعدا فرم را کامل کرده، دیگر رهاشده نیست.
     *
     * پیشرفتِ ناقص پاک نمی‌شود، پس ممکن است یک ردیف partial و یک ردیف
     * completed از یک نفر کنار هم باشند؛ بدون این بررسی، به کسی که کارش تمام
     * شده هم پیام «فرم را کامل کنید» می‌رفت.
     */
    if (partial.respondentKey) {
      const completed = await this.responseRepo.findOne({
        where: {
          publicationId: partial.publicationId,
          respondentKey: partial.respondentKey,
          status: ResponseStatus.COMPLETED,
        },
      });
      if (completed) {
        await this.markReminded(partial, now, null);
        return false;
      }
    }

    const contact = this.findContact(partial.answers, settings.channel);
    if (!contact) return false;

    const link = this.resumeLink(publication.token, partial.respondentKey);
    const body = this.buildBody(settings.message, form.title, link);

    const result = await this.messaging.send(
      {
        channel: contact.channel,
        recipient: contact.value,
        subject: contact.channel === 'email' ? `تکمیل «${form.title}»` : undefined,
        body,
        meta: { kind: 'abandoned-reminder', responseId: partial.id },
      },
      partial.publicationId,
    );

    await this.markReminded(partial, now, contact.channel);

    if (result.status === 'failed') {
      this.logger.warn(
        `یادآوری پاسخ ${partial.id} فرستاده نشد: ${result.providerMessage}`,
      );
      return false;
    }
    return true;
  }

  private async markReminded(
    partial: ResponseEntity,
    now: Date,
    channel: MessageChannel | null,
  ) {
    partial.meta = {
      ...partial.meta,
      remindedAt: now.toISOString(),
      ...(channel ? { reminderChannel: channel } : {}),
    };
    await this.responseRepo.save(partial);
  }

  /** خواندن تنظیمات یادآوری از settings فرم، با پیش‌فرض‌های امن. */
  private readSettings(raw: Record<string, unknown>): ReminderSettings {
    const r = (raw?.reminders ?? {}) as Record<string, unknown>;
    const delay = Number(r.delayHours);
    const channel = r.channel;
    return {
      enabled: r.enabled === true,
      delayHours:
        Number.isFinite(delay) && delay > 0 ? delay : DEFAULT_DELAY_HOURS,
      channel:
        channel === 'sms' || channel === 'email' ? channel : 'auto',
      message: typeof r.message === 'string' && r.message.trim() ? r.message : null,
    };
  }

  /**
   * پیدا کردن راه تماس از داخل پاسخ‌های ناقص.
   *
   * به‌جای وابستگی به اینکه کدام سوال «موبایل» یا «ایمیل» است، خودِ مقدارها
   * را با الگو تشخیص می‌دهد؛ این‌طوری فرقی نمی‌کند طراح فرم چه شناسه‌ای برای
   * آن سوال گذاشته باشد. موبایل بر ایمیل مقدم است چون پیامک در ایران
   * مطمئن‌تر به دست پاسخ‌دهنده می‌رسد.
   */
  private findContact(
    answers: Record<string, unknown>,
    prefer: ReminderSettings['channel'],
  ): { channel: MessageChannel; value: string } | null {
    const values = Object.values(answers ?? {})
      .filter((v): v is string => typeof v === 'string')
      .map((v) => v.trim());

    const mobile = values.map(normalizeMobile).find(Boolean);
    const email = values.find((v) => EMAIL_RE.test(v));

    if (prefer === 'sms') return mobile ? { channel: 'sms', value: mobile } : null;
    if (prefer === 'email') return email ? { channel: 'email', value: email } : null;

    if (mobile) return { channel: 'sms', value: mobile };
    if (email) return { channel: 'email', value: email };
    return null;
  }

  private resumeLink(token: string, respondentKey: string | null): string {
    const base = (process.env.PUBLIC_URL ?? '').replace(/\/+$/, '');
    const path = `/f/${token}`;
    const query = respondentKey
      ? `?r=${encodeURIComponent(respondentKey)}`
      : '';
    return `${base}${path}${query}`;
  }

  private buildBody(
    template: string | null,
    title: string,
    link: string,
  ): string {
    if (template) {
      return template
        .replace(/\{form\}/g, title)
        .replace(/\{link\}/g, link);
    }
    return `«${title}» را نیمه‌کاره رها کردید. برای ادامه از همان‌جا: ${link}`;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * موبایل ایرانی را به شکل استاندارد ۰۹xxxxxxxxx برمی‌گرداند، وگرنه رشته‌ی خالی.
 *
 * ارقام فارسی و عربی هم به لاتین تبدیل می‌شوند چون پاسخ‌دهنده معمولا با
 * صفحه‌کلید فارسی شماره می‌زند و «۰۹۱۲…» را درگاه پیامک نمی‌شناسد.
 */
function normalizeMobile(raw: string): string {
  const latin = raw.replace(/[۰-۹٠-٩]/g, (d) =>
    String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d) >= 0
      ? '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)
      : '٠١٢٣٤٥٦٧٨٩'.indexOf(d)),
  );
  const digits = latin.replace(/[^\d+]/g, '');
  let m = digits;
  if (m.startsWith('+98')) m = '0' + m.slice(3);
  else if (m.startsWith('0098')) m = '0' + m.slice(4);
  else if (m.startsWith('98') && m.length === 12) m = '0' + m.slice(2);
  else if (m.startsWith('9') && m.length === 10) m = '0' + m;
  return /^09\d{9}$/.test(m) ? m : '';
}
