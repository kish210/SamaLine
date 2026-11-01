import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { PersonnelEntity } from '../database/entities/personnel.entity';
import type { JwtUser } from '../common/current-user.decorator';

/**
 * «من کدام پرسنل هستم؟» برای مسیرهای نامه.
 *
 * جدا نگه داشته شده تا `LetterService` از مفهومِ «کاربرِ پنل» بی‌خبر بماند
 * و فقط با `personnelId` کار کند — همان چیزی که ربات هم دارد. پس هر دو
 * مسیر (پنل و ربات) به یک سرویسِ نامه می‌رسند بی‌آنکه هویت دو جا تعریف
 * شود.
 */
@Injectable()
export class LetterIdentityService {
  constructor(
    @InjectRepository(PersonnelEntity)
    private readonly people: Repository<PersonnelEntity>,
  ) {}

  /** پروندهٔ پرسنلیِ این کاربر، یا `null`. */
  async personnelId(user: JwtUser): Promise<string | null> {
    const person = await this.people.findOne({
      where: { organizationId: user.organizationId, userId: user.sub },
      select: { id: true },
    });
    return person?.id ?? null;
  }

  /** همان، ولی با خطای راهنما اگر وصل نباشد. */
  async requirePersonnelId(user: JwtUser): Promise<string> {
    const id = await this.personnelId(user);
    if (!id) {
      throw new BadRequestException(
        'حسابِ شما به پروندهٔ پرسنلی وصل نیست؛ از واحدِ منابع انسانی بخواهید آن را وصل کند.',
      );
    }
    return id;
  }

  /**
   * دفترِ نشانی: همکارانی که می‌شود به آن‌ها نامه فرستاد.
   *
   * خودِ کاربر در فهرست نمی‌آید، و پرسنلِ غیرفعال هم نه — نامه به کسی که
   * رفته است سندی می‌شد که هیچ‌وقت خوانده نمی‌شود.
   */
  async addressBook(organizationId: string, mePersonnelId: string) {
    const rows = await this.people.find({
      where: {
        organizationId,
        isActive: true,
        id: Not(mePersonnelId),
      },
      select: {
        id: true,
        fullName: true,
        position: true,
        departmentId: true,
      },
      order: { fullName: 'ASC' },
    });
    return rows.map((p) => ({
      personnelId: p.id,
      fullName: p.fullName,
      position: p.position,
      departmentId: p.departmentId,
    }));
  }
}
