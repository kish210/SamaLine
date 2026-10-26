import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Repository } from 'typeorm';
import { FormEntity, FormStatus } from '../database/entities/form.entity';
import { PublicationEntity } from '../database/entities/publication.entity';
import {
  ResponseEntity,
  ResponseStatus,
} from '../database/entities/response.entity';
import { DepartmentMemberEntity } from '../database/entities/department-member.entity';
import { UserEntity } from '../database/entities/user.entity';
import { MessagingService } from '../messaging/messaging.service';

/** هر ۱۰ دقیقه یک دور بررسی می‌شود؛ موعدِ ساعتی به این دقت نیاز دارد. */
const CHECK_INTERVAL_MS = 10 * 60 * 1000;

export interface ChecklistSettings {
  enabled: boolean;
  cadence: 'daily' | 'weekly';
  /** ساعتِ موعد (۰ تا ۲۳)؛ بعد از این ساعت اگر پر نشده باشد هشدار می‌رود. */
  dueHour: number;
  /** فقط برای هفتگی: روز هفته ۰=شنبه … ۶=جمعه (مطابق تقویم ایران). */
  weekday?: number;
  /** کلیدِ آخرین دوره‌ای که برایش هشدار رفت؛ از ارسال دوباره جلوگیری می‌کند. */
  lastAlertKey?: string;
}

/**
 * چک‌لیست‌های موعددار و هشدارِ انجام‌نشده (فاز C).
 *
 * فرمِ عملیاتی می‌تواند «چک‌لیست موعددار» باشد: باید هر روز (یا هر هفته) تا
 * ساعتِ معینی پر شود. این سرویس بعد از موعد بررسی می‌کند که آیا در همان دوره
 * پاسخِ کاملی ثبت شده؛ اگر نه، به اعضای بخشِ همان فرم هشدار می‌دهد.
 *
 * مثل ReminderService با یک تایمر ساده کار می‌کند، نه cron: به ثانیه دقت
 * لازم نیست و حالتِ کمتری دارد. حالتِ «قبلا هشدار داده شد» در خودِ
 * settings فرم (lastAlertKey) نگه داشته می‌شود تا جدول تازه‌ای لازم نشود.
 */
@Injectable()
export class ChecklistScheduleService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChecklistScheduleService.name);
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    @InjectRepository(FormEntity)
    private readonly formRepo: Repository<FormEntity>,
    @InjectRepository(PublicationEntity)
    private readonly publicationRepo: Repository<PublicationEntity>,
    @InjectRepository(ResponseEntity)
    private readonly responseRepo: Repository<ResponseEntity>,
    @InjectRepository(DepartmentMemberEntity)
    private readonly deptMembers: Repository<DepartmentMemberEntity>,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    private readonly messaging: MessagingService,
  ) {}

  onModuleInit() {
    if (process.env.CHECKLISTS_DISABLED === '1') {
      this.logger.log('هشدارِ چک‌لیست با CHECKLISTS_DISABLED خاموش است.');
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
    let alerted = 0;
    try {
      const forms = await this.formRepo.find({
        where: { status: FormStatus.ACTIVE },
        take: 500,
      });
      for (const form of forms) {
        if (await this.checkOne(form, now)) alerted += 1;
      }
    } catch (error) {
      this.logger.warn(
        `اجرای هشدارِ چک‌لیست ناموفق بود: ${(error as Error).message}`,
      );
    }
    return alerted;
  }

  private readSettings(form: FormEntity): ChecklistSettings | null {
    const raw = (form.settings?.checklist ?? null) as ChecklistSettings | null;
    if (!raw || raw.enabled !== true) return null;
    const dueHour = Number(raw.dueHour);
    return {
      enabled: true,
      cadence: raw.cadence === 'weekly' ? 'weekly' : 'daily',
      dueHour: Number.isFinite(dueHour) ? Math.min(23, Math.max(0, dueHour)) : 20,
      weekday: Number.isFinite(Number(raw.weekday))
        ? Number(raw.weekday)
        : undefined,
      lastAlertKey: typeof raw.lastAlertKey === 'string' ? raw.lastAlertKey : '',
    };
  }

  private async checkOne(form: FormEntity, now: Date): Promise<boolean> {
    const settings = this.readSettings(form);
    if (!settings) return false;

    // چک‌لیست بدونِ بخش، مخاطبی برای هشدار ندارد.
    if (!form.departmentId) return false;

    const period = this.currentPeriod(settings, now);
    // هنوز به موعدِ این دوره نرسیده‌ایم.
    if (now < period.dueAt) return false;
    // برای این دوره قبلا هشدار رفته است.
    if (settings.lastAlertKey === period.key) return false;

    // آیا در این دوره پاسخِ کاملی ثبت شده؟ اگر بله، کار انجام شده.
    const done = await this.hasCompletedSince(form.id, period.start);
    if (done) {
      // علامت می‌زنیم تا هر دور دوباره همین کوئری زده نشود.
      await this.markAlerted(form, settings, period.key);
      return false;
    }

    const recipients = await this.departmentEmails(form.departmentId);
    if (recipients.length === 0) {
      await this.markAlerted(form, settings, period.key);
      return false;
    }

    const when =
      settings.cadence === 'weekly' ? 'این هفته' : 'امروز';
    const body =
      `یادآوری: چک‌لیستِ «${form.title}» ${when} تا ساعتِ مقرر پر نشده است. ` +
      `لطفاً در اولین فرصت ثبتش کنید.`;

    await Promise.all(
      recipients.map((email) =>
        this.messaging.send({
          channel: 'email',
          recipient: email,
          subject: `چک‌لیستِ انجام‌نشده: ${form.title}`,
          body,
          meta: { kind: 'checklist-overdue', formId: form.id, period: period.key },
        }),
      ),
    );

    await this.markAlerted(form, settings, period.key);
    this.logger.log(
      `هشدارِ چک‌لیستِ «${form.title}» به ${recipients.length} نفر رفت (${period.key}).`,
    );
    return true;
  }

  /**
   * بازه‌ی دوره‌ی جاری و لحظه‌ی موعد.
   *
   * برای سادگی و پایداریِ کلید، مرزِ دوره بر مبنای UTC است؛ dueHour هم روی
   * همان ساعتِ UTC حساب می‌شود. برای هتلِ یک منطقه این کافی است و از
   * پیچیدگیِ منطقه‌ی زمانی پرهیز می‌کند.
   */
  private currentPeriod(
    settings: ChecklistSettings,
    now: Date,
  ): { key: string; start: Date; dueAt: Date } {
    if (settings.cadence === 'weekly') {
      const start = startOfWeek(now);
      const dueAt = new Date(start);
      dueAt.setUTCDate(dueAt.getUTCDate() + (settings.weekday ?? 0));
      dueAt.setUTCHours(settings.dueHour, 0, 0, 0);
      return { key: `W-${isoDate(start)}`, start, dueAt };
    }
    const start = startOfDay(now);
    const dueAt = new Date(start);
    dueAt.setUTCHours(settings.dueHour, 0, 0, 0);
    return { key: `D-${isoDate(start)}`, start, dueAt };
  }

  private async hasCompletedSince(formId: string, since: Date) {
    const pubs = await this.publicationRepo.find({
      where: { formId },
      select: { id: true },
    });
    if (pubs.length === 0) return false;
    const count = await this.responseRepo.count({
      where: {
        publicationId: In(pubs.map((p) => p.id)),
        status: ResponseStatus.COMPLETED,
        submittedAt: MoreThanOrEqual(since),
      },
    });
    return count > 0;
  }

  private async departmentEmails(departmentId: string): Promise<string[]> {
    const members = await this.deptMembers.find({
      where: { departmentId },
      select: { userId: true },
    });
    if (members.length === 0) return [];
    const users = await this.users.find({
      where: { id: In(members.map((m) => m.userId)) },
      select: { id: true, email: true },
    });
    return users.map((u) => u.email).filter((e): e is string => Boolean(e));
  }

  private async markAlerted(
    form: FormEntity,
    settings: ChecklistSettings,
    key: string,
  ) {
    form.settings = {
      ...form.settings,
      checklist: { ...settings, lastAlertKey: key },
    };
    await this.formRepo.save(form);
  }
}

function startOfDay(now: Date): Date {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** شروعِ هفته = شنبه (مطابق تقویم ایران). */
function startOfWeek(now: Date): Date {
  const d = startOfDay(now);
  // getUTCDay: ۰=یکشنبه … ۶=شنبه. شنبه را شروع می‌گیریم.
  const dow = d.getUTCDay();
  const sinceSaturday = (dow + 1) % 7;
  d.setUTCDate(d.getUTCDate() - sinceSaturday);
  return d;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
