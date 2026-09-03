import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContactEntity } from '../database/entities/contact.entity';
import { ContactListEntity } from '../database/entities/contact-list.entity';
import type { AddContactsDto, CreateContactListDto } from './dto';
import { normalizeMobile } from './source-mapper';

@Injectable()
export class ContactsService {
  constructor(
    @InjectRepository(ContactListEntity)
    private readonly listRepo: Repository<ContactListEntity>,
    @InjectRepository(ContactEntity)
    private readonly contactRepo: Repository<ContactEntity>,
  ) {}

  createList(organizationId: string, dto: CreateContactListDto) {
    return this.listRepo.save(
      this.listRepo.create({
        organizationId,
        name: dto.name,
        tags: dto.tags ?? [],
      }),
    );
  }

  listLists(organizationId: string) {
    return this.listRepo.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
  }

  async removeList(organizationId: string, listId: string) {
    const list = await this.requireList(organizationId, listId);
    await this.listRepo.remove(list);
    return { deleted: true };
  }

  /**
   * افزودن مخاطب با حذف تکراری‌ها.
   * مخاطب موجود (بر اساس موبایل یا ایمیل) به‌روزرسانی می‌شود تا
   * بارگذاری دوباره‌ی یک فایل، رکورد تکراری نسازد.
   */
  async addContacts(
    organizationId: string,
    listId: string,
    dto: AddContactsDto,
  ) {
    await this.requireList(organizationId, listId);

    const existing = await this.contactRepo.find({ where: { listId } });
    const byMobile = new Map(
      existing.filter((c) => c.mobile).map((c) => [c.mobile, c]),
    );
    const byEmail = new Map(
      existing.filter((c) => c.email).map((c) => [c.email, c]),
    );

    let created = 0;
    let updated = 0;
    const skipped: string[] = [];

    for (const input of dto.contacts) {
      // شماره از هر مسیری (CSV، دستی، API) به یک شکل درمی‌آید، وگرنه
      // همان مخاطب از دو مسیر دو رکورد می‌شد.
      const mobile = normalizeMobile(input.mobile) ?? null;
      const email = input.email?.trim().toLowerCase() || null;

      if (!mobile && !email) {
        skipped.push(input.fullName ?? 'بدون نام');
        continue;
      }

      const match =
        (mobile ? byMobile.get(mobile) : undefined) ??
        (email ? byEmail.get(email) : undefined);

      if (match) {
        match.fullName = input.fullName ?? match.fullName;
        match.mobile = mobile ?? match.mobile;
        match.email = email ?? match.email;
        match.variables = { ...match.variables, ...(input.variables ?? {}) };
        match.tags = input.tags ?? match.tags;
        await this.contactRepo.save(match);
        updated += 1;
        continue;
      }

      const saved = await this.contactRepo.save(
        this.contactRepo.create({
          listId,
          fullName: input.fullName ?? null,
          mobile,
          email,
          variables: input.variables ?? {},
          tags: input.tags ?? [],
          unsubscribed: false,
        }),
      );
      if (mobile) byMobile.set(mobile, saved);
      if (email) byEmail.set(email, saved);
      created += 1;
    }

    return { created, updated, skipped };
  }

  async listContacts(
    organizationId: string,
    listId: string,
    includeUnsubscribed = false,
  ) {
    await this.requireList(organizationId, listId);
    const contacts = await this.contactRepo.find({
      where: { listId },
      order: { createdAt: 'DESC' },
    });
    return includeUnsubscribed
      ? contacts
      : contacts.filter((c) => !c.unsubscribed);
  }

  /**
   * گیرندگان آماده‌ی کمپین برای یک کانال.
   * مخاطبان لغو اشتراک‌کرده و آن‌ها که آدرس این کانال را ندارند حذف می‌شوند.
   */
  async campaignRecipients(
    organizationId: string,
    listId: string,
    channel: 'sms' | 'email',
  ) {
    const contacts = await this.listContacts(organizationId, listId);

    const recipients: Array<{
      to: string;
      variables: Record<string, unknown>;
    }> = [];

    for (const contact of contacts) {
      const to = channel === 'sms' ? contact.mobile : contact.email;
      if (!to) continue;
      recipients.push({
        to,
        variables: { ...contact.variables, name: contact.fullName ?? '' },
      });
    }

    return recipients;
  }

  async unsubscribe(organizationId: string, listId: string, contactId: string) {
    await this.requireList(organizationId, listId);
    const contact = await this.contactRepo.findOne({
      where: { id: contactId, listId },
    });
    if (!contact) throw new NotFoundException('مخاطب یافت نشد');

    contact.unsubscribed = true;
    return this.contactRepo.save(contact);
  }

  async removeContact(
    organizationId: string,
    listId: string,
    contactId: string,
  ) {
    await this.requireList(organizationId, listId);
    const result = await this.contactRepo.delete({ id: contactId, listId });
    if (!result.affected) throw new NotFoundException('مخاطب یافت نشد');
    return { deleted: true };
  }

  /** فهرست باید متعلق به همان سازمان توکن باشد (جداسازی مستاجر). */
  private async requireList(organizationId: string, listId: string) {
    const list = await this.listRepo.findOne({
      where: { id: listId, organizationId },
    });
    if (!list) throw new NotFoundException('فهرست مخاطبان یافت نشد');
    return list;
  }

  /** ورودی CSV ساده: هر خط «نام,موبایل,ایمیل». */
  static parseCsv(csv: string) {
    const rows = csv
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (!rows.length) throw new BadRequestException('فایل خالی است');

    return rows.map((row) => {
      const [fullName, mobile, email] = row.split(',').map((c) => c.trim());
      return {
        fullName: fullName || undefined,
        mobile: mobile || undefined,
        email: email || undefined,
      };
    });
  }
}
