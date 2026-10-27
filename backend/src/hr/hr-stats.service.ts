import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PersonnelEntity } from '../database/entities/personnel.entity';
import {
  ResponseEntity,
  ResponseStatus,
} from '../database/entities/response.entity';

export interface PersonnelRequestStats {
  personnelId: string;
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

/**
 * گزارشِ HR: خلاصهٔ درخواست‌های هر پرسنل (تعداد، در انتظار، تأیید، رد).
 *
 * درخواست‌ها پاسخ‌نامه‌اند و به پرونده با موبایل وصل می‌شوند — همان کلیدی که
 * اعلانِ تأیید و «/درخواست‌ها»ِ ربات هم با آن کار می‌کنند. فقط پاسخ‌های فرم‌های
 * همان سازمان شمرده می‌شوند. وضعیتِ بررسی در `meta.review` (JSON) است و بین دو
 * گویشِ دیتابیس فیلترِ SQLِ یکسانی ندارد، پس تجمیع در حافظه انجام می‌شود.
 */
@Injectable()
export class HrStatsService {
  constructor(
    @InjectRepository(PersonnelEntity)
    private readonly people: Repository<PersonnelEntity>,
    @InjectRepository(ResponseEntity)
    private readonly responses: Repository<ResponseEntity>,
  ) {}

  async requestStats(organizationId: string): Promise<PersonnelRequestStats[]> {
    const people = await this.people.find({
      where: { organizationId },
      select: { id: true, mobile: true },
    });
    const byMobile = new Map<string, string>();
    for (const person of people) {
      if (person.mobile) byMobile.set(person.mobile, person.id);
    }
    if (byMobile.size === 0) return [];

    const rows = await this.responses
      .createQueryBuilder('response')
      .innerJoin('response.formVersion', 'formVersion')
      .innerJoin('formVersion.form', 'form')
      .innerJoin('form.workspace', 'workspace')
      .select(['response.id', 'response.respondentKey', 'response.meta'])
      .where('workspace.organizationId = :organizationId', { organizationId })
      .andWhere('response.respondentKey IN (:...keys)', {
        keys: [...byMobile.keys()],
      })
      .andWhere('response.status = :status', {
        status: ResponseStatus.COMPLETED,
      })
      .getMany();

    const stats = new Map<string, PersonnelRequestStats>();
    for (const row of rows) {
      const personnelId = byMobile.get(row.respondentKey ?? '');
      if (!personnelId) continue;
      const entry = stats.get(personnelId) ?? {
        personnelId,
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
      };
      entry.total += 1;
      const status = (row.meta?.review as { status?: string } | undefined)
        ?.status;
      if (status === 'pending') entry.pending += 1;
      else if (status === 'approved') entry.approved += 1;
      else if (status === 'rejected') entry.rejected += 1;
      stats.set(personnelId, entry);
    }
    return [...stats.values()];
  }
}
