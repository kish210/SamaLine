import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkspaceEntity } from '../database/entities/workspace.entity';
import { TelegramIntegrationEntity } from '../database/entities/telegram-integration.entity';
import { HrService } from '../hr/hr.service';
import { LeaveService } from '../hr/leave.service';
import type { LeaveType } from '../database/entities/leave-request.entity';
import { TelegramBotService } from '../integrations/telegram-bot.service';

/** پیام‌رسان‌هایی که همین حالا پشتیبانی می‌شوند. */
const KNOWN_PLATFORMS = ['bale', 'telegram'];

/**
 * «من»: چیزهایی که هر کاربرِ واردشده دربارهٔ خودش می‌بیند و می‌کند.
 *
 * هویت همیشه از توکن می‌آید؛ هیچ ورودی‌ای از بدنهٔ کلاینت تعیین نمی‌کند
 * «من کی هستم». پس یک کاربر نمی‌تواند پروندهٔ دیگری را از این مسیر ببیند
 * یا گفتگوی پیام‌رسانی را به پروندهٔ دیگری بچسباند.
 */
@Injectable()
export class MeService {
  constructor(
    private readonly hr: HrService,
    private readonly bot: TelegramBotService,
    @InjectRepository(WorkspaceEntity)
    private readonly workspaces: Repository<WorkspaceEntity>,
    @InjectRepository(TelegramIntegrationEntity)
    private readonly bots: Repository<TelegramIntegrationEntity>,
    private readonly leaves: LeaveService,
  ) {}

  /**
   * ثبتِ مرخصی برای خودِ کاربر.
   *
   * `personnelId` از پروندهٔ متصلِ همین کاربر می‌آید و هر مقداری که کلاینت
   * بفرستد بی‌اثر است؛ پس کسی نمی‌تواند به نامِ همکارش مرخصی ثبت کند.
   * قاعده‌های مرخصی (هم‌پوشانی، شمارشِ روز، گردشِ تأیید) همان قاعده‌های
   * `LeaveService` است، چون همان سرویس صدا زده می‌شود.
   */
  async requestLeave(
    organizationId: string,
    userId: string,
    input: {
      fromDate: string;
      toDate: string;
      type?: LeaveType;
      reason?: string;
      days?: number;
    },
  ) {
    const person = await this.requirePersonnel(organizationId, userId);
    return this.leaves.create(
      organizationId,
      { ...input, personnelId: person.id },
      userId,
    );
  }

  /**
   * پروندهٔ پرسنلیِ همین کاربر، یا `null`.
   *
   * `null` حالتِ عادی و قابلِ‌انتظاری است (حسابی که HR هنوز وصل نکرده)، پس
   * خطا نمی‌دهیم؛ پنل با همین `null` پیامِ راهنما نشان می‌دهد تا کاربر
   * عددِ صفر را با «کاری ندارم» اشتباه نگیرد.
   */
  async profile(organizationId: string, userId: string) {
    const person = await this.hr.findByUser(organizationId, userId);
    if (!person) {
      return {
        linked: false as const,
        personnel: null,
        botLinks: [],
        platforms: KNOWN_PLATFORMS,
      };
    }
    const links = await this.hr.linksOf(organizationId, person.id);
    return {
      linked: true as const,
      personnel: {
        id: person.id,
        fullName: person.fullName,
        position: person.position,
        departmentId: person.departmentId,
        employeeNo: person.employeeNo,
        mobile: person.mobile,
        employmentStatus: person.employmentStatus,
      },
      botLinks: links.map((l) => ({
        platform: l.platform,
        linkedAt: l.linkedAt,
        /*
         * شناسهٔ گفتگو برنمی‌گردد.
         *
         * برای کاربر بی‌معناست و دانستنش فقط به کسی کمک می‌کند که بخواهد
         * جایی دیگر جعلش کند؛ «وصل است یا نه» تمامِ چیزی است که لازم دارد.
         */
      })),
      platforms: KNOWN_PLATFORMS,
    };
  }

  /** پروندهٔ متصل، یا خطای روشن اگر وصل نیست. */
  private async requirePersonnel(organizationId: string, userId: string) {
    const person = await this.hr.findByUser(organizationId, userId);
    if (!person) {
      throw new BadRequestException(
        'حسابِ شما به پروندهٔ پرسنلی وصل نیست؛ از واحدِ منابع انسانی بخواهید آن را وصل کند.',
      );
    }
    return person;
  }

  /**
   * کدِ اتصالِ یک پیام‌رسان به پروندهٔ خودِ کاربر.
   *
   * ربات به‌ازای هر فضای کاری تنظیم می‌شود، پس اولین فضای کاریِ سازمان که
   * رباتِ فعال دارد انتخاب می‌شود. اگر هیچ رباتی فعال نباشد، خطای روشن
   * می‌دهیم نه کدی که هیچ‌جا کار نمی‌کند.
   */
  async createBotLinkCode(organizationId: string, userId: string) {
    const person = await this.requirePersonnel(organizationId, userId);

    const workspaces = await this.workspaces.find({
      where: { organizationId },
      select: { id: true },
    });
    if (workspaces.length === 0) {
      throw new BadRequestException('فضای کاریِ فعالی نیست.');
    }

    let chosen: TelegramIntegrationEntity | null = null;
    for (const ws of workspaces) {
      const found = await this.bots.findOne({ where: { workspaceId: ws.id } });
      if (found?.isActive) {
        chosen = found;
        break;
      }
    }
    if (!chosen) {
      throw new BadRequestException(
        'رباتِ فعالی برای این سازمان تنظیم نشده است؛ از مدیر بخواهید ربات را وصل کند.',
      );
    }

    return this.bot.createPersonnelLinkCode({
      workspaceId: chosen.workspaceId,
      personnelId: person.id,
      label: person.fullName,
    });
  }

  /** قطعِ یک پیام‌رسان از پروندهٔ خودِ کاربر. */
  async removeBotLink(
    organizationId: string,
    userId: string,
    platform: string,
  ) {
    const person = await this.requirePersonnel(organizationId, userId);
    if (!KNOWN_PLATFORMS.includes(platform)) {
      throw new BadRequestException('این پیام‌رسان شناخته نمی‌شود.');
    }
    return this.hr.unlinkPlatform(organizationId, person.id, platform);
  }
}
