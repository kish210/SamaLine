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
