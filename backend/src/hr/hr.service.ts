import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PersonnelEntity,
  type PersonnelDocument,
  ContractType,
  EmploymentStatus,
} from '../database/entities/personnel.entity';
import { PersonnelBotLinkEntity } from '../database/entities/personnel-bot-link.entity';

export interface PersonnelInput {
  fullName?: string;
  mobile?: string;
  employeeNo?: string;
  position?: string;
  departmentId?: string | null;
  hireDate?: string;
  documents?: PersonnelDocument[];
  notes?: string;
  isActive?: boolean;
  /** وضعیتِ اشتغال و قرارداد (فاز HR). */
  employmentStatus?: EmploymentStatus;
  contractType?: ContractType;
  contractEndsAt?: string;
  terminatedAt?: string;
}

/** فقط رقم‌های موبایل را نگه می‌دارد تا یکتاییِ موبایل به نگارش حساس نباشد. */
function normalizeMobile(raw: string | undefined): string {
  return (raw ?? '').replace(/\D/g, '').slice(0, 20);
}

/**
 * پروندهٔ پرسنل به‌عنوان داده‌ی پایهٔ HR (فاز E).
 *
 * پرسنل سطحِ سازمان‌اند (نه فضای کاری) چون داده‌ی مرجعِ کلِ هتل‌اند.
 * `organizationId` همیشه از توکن. موبایل کلیدِ اتصال به ربات بله در فاز F است،
 * پس وقتی پر باشد در هر سازمان یکتاست.
 */
@Injectable()
export class HrService {
  constructor(
    @InjectRepository(PersonnelEntity)
    private readonly people: Repository<PersonnelEntity>,
    @InjectRepository(PersonnelBotLinkEntity)
    private readonly botLinks: Repository<PersonnelBotLinkEntity>,
  ) {}

  list(organizationId: string) {
    return this.people.find({
      where: { organizationId },
      order: { fullName: 'ASC' },
    });
  }

  /**
   * فهرستِ پرسنل با سکوهای وصل‌شدهٔ هر نفر.
   *
   * ستونِ «ربات» در پنل باید وضعیتِ واقعی را نشان دهد؛ پس از انتقال اتصال
   * به `personnel_bot_links`، خواندنِ ستونِ منسوخِ `botChatId` همه را
   * «وصل‌نشده» نشان می‌داد.
   */
  async listWithLinks(organizationId: string) {
    const [people, links] = await Promise.all([
      this.list(organizationId),
      this.botLinks.find({ where: { organizationId } }),
    ]);
    const byPerson = new Map<string, string[]>();
    for (const link of links) {
      byPerson.set(link.personnelId, [
        ...(byPerson.get(link.personnelId) ?? []),
        link.platform,
      ]);
    }
    return people.map((person) => ({
      ...person,
      botPlatforms: byPerson.get(person.id) ?? [],
    }));
  }

  async create(organizationId: string, input: PersonnelInput) {
    const fullName = (input.fullName ?? '').trim();
    if (!fullName) throw new BadRequestException('نام پرسنل لازم است');
    const mobile = normalizeMobile(input.mobile);
    if (mobile) await this.assertMobileFree(organizationId, mobile);
    return this.people.save(
      this.people.create({
        organizationId,
        fullName: fullName.slice(0, 120),
        mobile,
        employeeNo: (input.employeeNo ?? '').slice(0, 40),
        position: (input.position ?? '').slice(0, 80),
        departmentId: input.departmentId ?? null,
        hireDate: sanitizeDate(input.hireDate),
        documents: input.documents ?? [],
        notes: input.notes ?? '',
        isActive: input.isActive ?? true,
      }),
    );
  }

  async update(organizationId: string, id: string, input: PersonnelInput) {
    const person = await this.assertPerson(organizationId, id);
    if (input.fullName !== undefined) {
      const fullName = input.fullName.trim();
      if (!fullName) throw new BadRequestException('نام پرسنل لازم است');
      person.fullName = fullName.slice(0, 120);
    }
    if (input.mobile !== undefined) {
      const mobile = normalizeMobile(input.mobile);
      if (mobile && mobile !== person.mobile) {
        await this.assertMobileFree(organizationId, mobile);
      }
      person.mobile = mobile;
    }
    if (input.employeeNo !== undefined)
      person.employeeNo = input.employeeNo.slice(0, 40);
    if (input.position !== undefined)
      person.position = input.position.slice(0, 80);
    if (input.departmentId !== undefined)
      person.departmentId = input.departmentId ?? null;
    if (input.hireDate !== undefined)
      person.hireDate = sanitizeDate(input.hireDate);
    if (input.documents !== undefined) person.documents = input.documents;
    if (input.notes !== undefined) person.notes = input.notes;
    if (input.isActive !== undefined) person.isActive = input.isActive;
    if (input.employmentStatus !== undefined)
      person.employmentStatus = input.employmentStatus;
    if (input.contractType !== undefined)
      person.contractType = input.contractType;
    if (input.contractEndsAt !== undefined)
      person.contractEndsAt = sanitizeDate(input.contractEndsAt);
    /*
     * ثبتِ تاریخِ پایانِ همکاری، وضعیت را هم «قطعِ همکاری» می‌کند تا این دو
     * از هم واگرا نشوند و گزارشِ نیروی فعال درست بماند.
     */
    if (input.terminatedAt !== undefined) {
      person.terminatedAt = sanitizeDate(input.terminatedAt);
      if (person.terminatedAt) {
        person.employmentStatus = EmploymentStatus.TERMINATED;
      }
    }
    return this.people.save(person);
  }

  async remove(organizationId: string, id: string) {
    await this.assertPerson(organizationId, id);
    await this.people.delete({ id });
    return { ok: true };
  }

  /** پیدا کردن پرسنل با موبایل — زیرساختِ ورود/اتصالِ بله در فاز F. */
  findByMobile(organizationId: string, mobile: string) {
    const normalized = normalizeMobile(mobile);
    if (!normalized) return Promise.resolve(null);
    return this.people.findOne({
      where: { organizationId, mobile: normalized },
    });
  }

  /** پروندهٔ پرسنلِ یک حسابِ کاربریِ پنل؛ مبنای «میزِ کارِ من». */
  findByUser(organizationId: string, userId: string) {
    if (!userId) return Promise.resolve(null);
    return this.people.findOne({ where: { organizationId, userId } });
  }

  /**
   * اتصال/قطعِ حسابِ کاربری به پروندهٔ پرسنل — کارِ HR.
   *
   * `null` یعنی قطعِ اتصال. یکتاییِ `(organizationId, userId)` با ایندکسِ
   * دیتابیس محافظت می‌شود؛ اینجا هم پیشاپیش بررسی می‌شود تا خطای فارسیِ
   * روشن بدهد نه خطای محدودیتِ خام.
   */
  async setUserLink(
    organizationId: string,
    personnelId: string,
    userId: string | null,
  ) {
    const person = await this.assertPerson(organizationId, personnelId);
    if (userId) {
      const clash = await this.people.findOne({
        where: { organizationId, userId },
      });
      if (clash && clash.id !== person.id) {
        throw new BadRequestException(
          `این حسابِ کاربری به پروندهٔ «${clash.fullName}» وصل است`,
        );
      }
    }
    person.userId = userId;
    return this.people.save(person);
  }

  /** پرسنلِ متصل به یک گفتگوی ربات — برای پاسخ‌دهی و اعلان. */
  async findByChat(botChatId: string, botPlatform: string) {
    if (!botChatId) return null;
    const link = await this.botLinks.findOne({
      where: { chatId: botChatId, platform: botPlatform },
    });
    if (!link) return null;
    return this.people.findOne({ where: { id: link.personnelId } });
  }

  /** سکوهای وصل‌شدهٔ یک پرسنل؛ برای بخشِ «حساب‌های پیام‌رسانِ من». */
  linksOf(organizationId: string, personnelId: string) {
    return this.botLinks.find({
      where: { organizationId, personnelId },
      order: { platform: 'ASC' },
    });
  }

  /**
   * اتصالِ یک گفتگو به یک پروندهٔ پرسنلِ مشخص.
   *
   * مسیرِ کدِ یک‌بارمصرف از این استفاده می‌کند (هویت پیش از این احراز شده)،
   * و مسیرِ موبایلی هم پس از پیدا کردنِ پرسنل به همین می‌رسد. گفتگو از هر
   * پرسنلِ دیگری که قبلاً به آن وصل بوده جدا می‌شود، تا یک گفتگو تنها به یک
   * نفر برسد و پیامِ شخصی به نفرِ اشتباه نرود.
   */
  async linkChatToPersonnel(
    organizationId: string,
    personnelId: string,
    platform: string,
    chatId: string,
    workspaceId?: string | null,
  ): Promise<PersonnelEntity | null> {
    const person = await this.people.findOne({
      where: { id: personnelId, organizationId },
    });
    if (!person || !person.isActive) return null;

    // همین گفتگو، هر جا که بوده، آزاد می‌شود.
    await this.botLinks.delete({ platform, chatId });
    // و همین نفر در همین سکو فقط یک گفتگو دارد.
    await this.botLinks.delete({ personnelId: person.id, platform });

    await this.botLinks.save(
      this.botLinks.create({
        organizationId,
        personnelId: person.id,
        platform,
        chatId,
        workspaceId: workspaceId ?? null,
      }),
    );
    return person;
  }

  /**
   * اتصالِ یک گفتگوی رباتِ پرسنل به پروندهٔ پرسنل با موبایل (فاز F).
   *
   * فقط پرسنلِ فعال وصل می‌شود. اگر همان گفتگو قبلا به پرسنلِ دیگری وصل بوده
   * (مثلا موبایلِ اشتباه)، اتصالِ قبلی پاک می‌شود تا یک گفتگو تنها به یک پرسنل
   * متصل بماند. نتیجه: پرسنلِ وصل‌شده یا null اگر موبایل پیدا نشد.
   */
  async linkBotChat(
    organizationId: string,
    mobile: string,
    botChatId: string,
    botPlatform: string,
    botWorkspaceId?: string,
  ): Promise<PersonnelEntity | null> {
    const person = await this.findByMobile(organizationId, mobile);
    if (!person) return null;
    return this.linkChatToPersonnel(
      organizationId,
      person.id,
      botPlatform,
      botChatId,
      botWorkspaceId,
    );
  }

  /** قطعِ اتصالِ یک گفتگوی ربات از پرونده. */
  async unlinkBotChat(botChatId: string, botPlatform: string) {
    const { affected } = await this.botLinks.delete({
      chatId: botChatId,
      platform: botPlatform,
    });
    return { unlinked: Boolean(affected) };
  }

  /** قطعِ یک سکو از پروندهٔ خودِ کاربر («داشبورد من»). */
  async unlinkPlatform(
    organizationId: string,
    personnelId: string,
    platform: string,
  ) {
    const { affected } = await this.botLinks.delete({
      organizationId,
      personnelId,
      platform,
    });
    return { unlinked: Boolean(affected) };
  }

  /**
   * مقصدهای پیامِ سازمانی: یک سطر به‌ازای هر گفتگوی وصل‌شده.
   *
   * به‌ازای هر **اتصال** برمی‌گردد نه هر پرسنل، چون یک نفر می‌تواند هم بله
   * داشته باشد هم تلگرام و پیام باید به هر دو برسد. فقط پرسنلِ فعال؛ با
   * بخش فیلتر می‌شود تا اطلاعیه به یک بخش محدود بماند.
   */
  async linkedTargets(organizationId: string, departmentId?: string | null) {
    const qb = this.botLinks
      .createQueryBuilder('l')
      .innerJoin(PersonnelEntity, 'p', 'p.id = l.personnelId')
      .select('l.personnelId', 'personnelId')
      .addSelect('l.platform', 'platform')
      .addSelect('l.chatId', 'chatId')
      .addSelect('l.workspaceId', 'workspaceId')
      .addSelect('p.fullName', 'fullName')
      .addSelect('p.organizationId', 'organizationId')
      .addSelect('p.departmentId', 'departmentId')
      .where('l.organizationId = :org', { org: organizationId })
      .andWhere('p.isActive = :active', { active: true });
    if (departmentId) {
      qb.andWhere('p.departmentId = :dep', { dep: departmentId });
    }
    return qb.getRawMany<{
      personnelId: string;
      platform: string;
      chatId: string;
      workspaceId: string | null;
      fullName: string;
      organizationId: string;
      departmentId: string | null;
    }>();
  }

  private async assertMobileFree(organizationId: string, mobile: string) {
    const clash = await this.people.findOne({
      where: { organizationId, mobile },
    });
    if (clash)
      throw new BadRequestException(`موبایل «${mobile}» برای پرسنلِ دیگری ثبت شده`);
  }

  private async assertPerson(organizationId: string, id: string) {
    const person = await this.people.findOne({
      where: { id, organizationId },
    });
    if (!person) throw new NotFoundException('پرسنل یافت نشد');
    return person;
  }
}

/** تاریخ را به 'YYYY-MM-DD' محدود می‌کند؛ ورودیِ نامعتبر خالی می‌شود. */
function sanitizeDate(raw: string | undefined): string {
  const value = (raw ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
}
