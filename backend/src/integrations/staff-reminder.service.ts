import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { TelegramIntegrationEntity } from '../database/entities/telegram-integration.entity';
import { PersonnelEntity } from '../database/entities/personnel.entity';
import {
  StaffReminderKind,
  StaffReminderLogEntity,
} from '../database/entities/work-shift.entity';
import { WorkspaceEntity } from '../database/entities/workspace.entity';
import { MaintenancePriority } from '../database/entities/maintenance-request.entity';
import { CmmsService } from '../cmms/cmms.service';
import { ShiftService, shiftDate, todayIso } from '../hr/shift.service';
import { isoToJalaliText } from '../common/jalali';
import { TelegramApi, platformApiBase } from './telegram-api';

/** هر ربعِ ساعت بررسی می‌شود؛ پنجره‌های ارسال ساعتی‌اند. */
const CHECK_INTERVAL_MS = 15 * 60 * 1000;

/**
 * ساعتِ ارسال (UTC).
 *
 * سرور با UTC کار می‌کند و ایران +۳:۳۰ است، پس ۰۳:۰۰ UTC حدودِ ۰۶:۳۰ صبحِ
 * تهران و ۱۴:۰۰ UTC حدودِ ۱۷:۳۰ عصر می‌شود: کارها صبحِ شیفت و شیفتِ فردا
 * عصرِ روزِ قبل یادآوری می‌شوند.
 */
const TASKS_HOUR_UTC = Number(process.env.STAFF_TASKS_REMINDER_HOUR ?? 3);
const SHIFT_HOUR_UTC = Number(process.env.STAFF_SHIFT_REMINDER_HOUR ?? 14);

/**
 * یادآوریِ کار و شیفت به رباتِ پرسنل.
 *
 * دو پیام در روز، و نه بیشتر: صبح «امروز این کارها به تو سپرده شده» و عصر
 * «فردا این شیفت را داری». هر ارسال در `staff_reminder_log` ثبت می‌شود و
 * ایندکسِ یکتا تضمین می‌کند که اجرای دوباره — یا ری‌استارتِ سرور — پیامِ
 * تکراری نفرستد؛ حافظهٔ درون‌پروسه این تضمین را نمی‌داد.
 *
 * هرگز throw نمی‌کند: یک پرسنلِ مشکل‌دار نباید بقیه را از یادآوری محروم کند.
 */
@Injectable()
export class StaffReminderService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StaffReminderService.name);
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    @InjectRepository(PersonnelEntity)
    private readonly people: Repository<PersonnelEntity>,
    @InjectRepository(StaffReminderLogEntity)
    private readonly log: Repository<StaffReminderLogEntity>,
    @InjectRepository(TelegramIntegrationEntity)
    private readonly bots: Repository<TelegramIntegrationEntity>,
    @InjectRepository(WorkspaceEntity)
    private readonly workspaces: Repository<WorkspaceEntity>,
    private readonly shifts: ShiftService,
    private readonly cmms: CmmsService,
    private readonly api: TelegramApi,
  ) {}

  onModuleInit() {
    if (process.env.STAFF_REMINDERS_DISABLED === '1') {
      this.logger.log('یادآوریِ کار و شیفت خاموش است (STAFF_REMINDERS_DISABLED).');
      return;
    }
    this.timer = setInterval(() => void this.run(), CHECK_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /**
   * یک دور اجرا؛ تعدادِ پیامِ فرستاده‌شده برمی‌گردد.
   *
   * `now` پارامتر است تا تست بتواند پنجرهٔ ساعت را بسازد، بدونِ ساعتِ جعلیِ
   * سراسری.
   */
  async run(now = new Date()): Promise<number> {
    const hour = now.getUTCHours();
    const kinds: StaffReminderKind[] = [];
    if (hour === TASKS_HOUR_UTC) kinds.push(StaffReminderKind.TASKS);
    if (hour === SHIFT_HOUR_UTC) kinds.push(StaffReminderKind.SHIFT);
    if (kinds.length === 0) return 0;

    let sent = 0;
    for (const kind of kinds) {
      try {
        sent += await this.runKind(kind, now);
      } catch (error) {
        this.logger.warn(
          `یادآوریِ «${kind}» ناموفق بود: ${(error as Error).message}`,
        );
      }
    }
    if (sent > 0) this.logger.log(`${sent} یادآوری به پرسنل رفت.`);
    return sent;
  }

  /** یک نوعِ یادآوری برای همهٔ پرسنلِ وصل‌به‌ربات. */
  async runKind(kind: StaffReminderKind, now = new Date()): Promise<number> {
    const today = now.toISOString().slice(0, 10);
    // شیفت برای فردا یادآوری می‌شود، کار برای همین امروز.
    const forDate =
      kind === StaffReminderKind.SHIFT ? shiftDate(today, 1) : today;

    const people = await this.people
      .createQueryBuilder('p')
      .where('p.isActive = :active', { active: true })
      .andWhere('p.botChatId IS NOT NULL')
      .andWhere("p.botChatId <> ''")
      .take(500)
      .getMany();
    if (people.length === 0) return 0;

    // کسانی که همین امروز همین نوع را گرفته‌اند، دوباره نمی‌گیرند.
    const already = await this.log.find({
      where: {
        kind,
        forDate,
        personnelId: In(people.map((p) => p.id)),
      },
      select: { personnelId: true },
    });
    const done = new Set(already.map((r) => r.personnelId));

    let sent = 0;
    const botCache = new Map<string, TelegramIntegrationEntity | null>();

    for (const person of people) {
      if (done.has(person.id)) continue;
      try {
        const text =
          kind === StaffReminderKind.SHIFT
            ? await this.shiftText(person, forDate)
            : await this.taskText(person, forDate);
        // چیزی برای گفتن نبود: سطرِ دفتر هم نمی‌نویسیم تا اگر بعداً شیفت
        // اضافه شد، همان روز یادآوری برود.
        if (!text) continue;

        const bot = await this.botOf(person, botCache);
        if (!bot) continue;

        const result = await this.api.send(
          bot.botToken,
          person.botChatId as string,
          text,
          platformApiBase(person.botPlatform || bot.platform),
        );
        if (!result.ok) continue;

        /*
         * دفتر بعد از ارسالِ موفق نوشته می‌شود.
         *
         * اگر پیش از ارسال بود، یک خطای شبکه یادآوری را برای همیشه می‌خورد.
         * ایندکسِ یکتا هم مانعِ سطرِ تکراریِ هم‌زمان است، پس خطای آن بی‌خطر
         * نادیده گرفته می‌شود.
         */
        await this.log
          .save(
            this.log.create({
              organizationId: person.organizationId,
              personnelId: person.id,
              kind,
              forDate,
            }),
          )
          .catch(() => undefined);
        sent += 1;
      } catch (error) {
        this.logger.warn(
          `یادآوری به «${person.fullName}» نرفت: ${(error as Error).message}`,
        );
      }
    }
    return sent;
  }

  /** متنِ یادآوریِ شیفت؛ خالی یعنی شیفتی نیست. */
  private async shiftText(
    person: PersonnelEntity,
    forDate: string,
  ): Promise<string> {
    const rows = await this.shifts.myShifts(person.id, forDate, forDate);
    if (rows.length === 0) return '';

    const lines = [
      `🗓 <b>شیفتِ فردا</b> — ${isoToJalaliText(forDate)}`,
      '',
      ...rows.map(
        (s) =>
          `• ${s.startTime} تا ${s.endTime}${s.label ? ` (${s.label})` : ''}${
            s.note ? `\n  ${s.note}` : ''
          }`,
      ),
      '',
      'سرِ شیفت «🟢 ثبتِ ورود» را بزنید.',
    ];
    return lines.join('\n');
  }

  /** متنِ یادآوریِ کارها؛ خالی یعنی کارِ بازی نیست. */
  private async taskText(
    person: PersonnelEntity,
    forDate: string,
  ): Promise<string> {
    const orders = await this.cmms.workOrdersOfTechnician(
      person.organizationId,
      person.id,
      { limit: 10 },
    );
    if (orders.length === 0) return '';

    const lines = [`🔧 <b>کارهای شما</b> — ${isoToJalaliText(forDate)}`, ''];
    for (const o of orders) {
      const marks = [
        o.priority === MaintenancePriority.EMERGENCY ? '🚨 اضطراری' : '',
        o.dueDate && o.dueDate < forDate ? '⏰ عقب‌افتاده' : '',
      ].filter(Boolean);
      lines.push(
        `• <b>${o.number}</b> — ${o.title}${
          marks.length > 0 ? ` (${marks.join(' · ')})` : ''
        }`,
      );
    }
    lines.push('', 'برای شروع یا تکمیل، «🔧 کارهای من» را بزنید.');
    return lines.join('\n');
  }

  /** رباتِ همان فضای کاری که پرسنل از طریقش وصل شده. */
  private async botOf(
    person: PersonnelEntity,
    cache: Map<string, TelegramIntegrationEntity | null>,
  ): Promise<TelegramIntegrationEntity | null> {
    /*
     * اگر فضای کاریِ اتصال ثبت نشده (اتصال‌های قدیمی)، از سازمانِ پرسنل
     * پیدا می‌شود؛ وگرنه آن پرسنل هیچ‌وقت یادآوری نمی‌گرفت.
     */
    let wsId = person.botWorkspaceId;
    if (!wsId) {
      const ws = await this.workspaces.findOne({
        where: { organizationId: person.organizationId },
        select: { id: true },
      });
      wsId = ws?.id ?? null;
    }
    if (!wsId) return null;

    if (!cache.has(wsId)) {
      cache.set(wsId, await this.bots.findOne({ where: { workspaceId: wsId } }));
    }
    const bot = cache.get(wsId) ?? null;
    return bot?.isActive ? bot : null;
  }

  /** امروز، برای تست‌ها. */
  static today(): string {
    return todayIso();
  }
}
