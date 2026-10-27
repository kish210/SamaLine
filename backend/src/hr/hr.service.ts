import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import {
  PersonnelEntity,
  type PersonnelDocument,
} from '../database/entities/personnel.entity';

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
  ) {}

  list(organizationId: string) {
    return this.people.find({
      where: { organizationId },
      order: { fullName: 'ASC' },
    });
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

  /** پرسنلِ متصل به یک گفتگوی ربات — برای پاسخ‌دهی و اعلان (فاز F). */
  findByChat(botChatId: string, botPlatform: string) {
    if (!botChatId) return Promise.resolve(null);
    return this.people.findOne({ where: { botChatId, botPlatform } });
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
    if (!person || !person.isActive) return null;

    // گفتگو را از هر پرسنلِ دیگری که قبلا به آن وصل بوده جدا کن.
    await this.people.update(
      { botChatId, botPlatform },
      { botChatId: null, botPlatform: '', botWorkspaceId: null },
    );

    person.botChatId = botChatId;
    person.botPlatform = botPlatform;
    person.botWorkspaceId = botWorkspaceId ?? null;
    return this.people.save(person);
  }

  /** قطعِ اتصالِ یک گفتگوی ربات از پرونده (فاز F). */
  async unlinkBotChat(botChatId: string, botPlatform: string) {
    const { affected } = await this.people.update(
      { botChatId, botPlatform },
      { botChatId: null, botPlatform: '', botWorkspaceId: null },
    );
    return { unlinked: Boolean(affected) };
  }

  /**
   * پرسنلِ فعالِ وصل‌به‌ربات — مقصدِ اطلاعیه‌های سازمانی (فاز F).
   * با بخش فیلتر می‌شود تا اطلاعیه فقط به یک بخش برود.
   */
  linkedPersonnel(organizationId: string, departmentId?: string | null) {
    const where: Record<string, unknown> = {
      organizationId,
      isActive: true,
      botChatId: Not(IsNull()),
    };
    if (departmentId) where.departmentId = departmentId;
    return this.people.find({ where });
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
