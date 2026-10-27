import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DepartmentEntity } from '../database/entities/department.entity';
import { FormEntity, FormStatus } from '../database/entities/form.entity';
import {
  ResponseEntity,
  ResponseStatus,
} from '../database/entities/response.entity';

const DAY_MS = 86_400_000;

/**
 * روزِ تقویمیِ هتل، نه UTC: پاسخِ ساعت ۲ بامدادِ تهران باید در همان روز بیاید.
 * کلید 'YYYY-MM-DD' (میلادی) است؛ پنل آن را شمسی نمایش می‌دهد.
 */
const tehranDay = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tehran',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const dayKey = (date: Date) => tehranDay.format(date);

export interface OverviewScope {
  isManager: boolean;
  departmentIds: string[];
}

export interface ManagerOverview {
  days: number;
  totals: {
    /** گزارش‌های کاملِ بازه‌ی جاری. */
    current: number;
    /** همان طول بازه، درست پیش از آن — برای مقایسه. */
    previous: number;
    /** درصدِ تغییر؛ null وقتی بازه‌ی قبل صفر بوده (تقسیم بر صفر بی‌معناست). */
    changePct: number | null;
  };
  /** pending همه‌ی درخواست‌های معلقِ کنونی است؛ تأیید/رد فقط در بازه‌ی جاری. */
  review: { pending: number; approved: number; rejected: number };
  activeForms: number;
  series: Array<{ date: string; count: number }>;
  byUnit: Array<{ departmentId: string | null; name: string; count: number }>;
  topForms: Array<{ formId: string; title: string; count: number }>;
}

/**
 * نمای کلیِ مدیریتی: یک نگاه به کلِ عملیاتِ هتل در یک فضای کاری.
 *
 * اسکوپِ بخش مثلِ فهرستِ فرم‌ها و کارتابل است: مدیر همه را می‌بیند، کارمندِ
 * غیرمدیر فقط فرم‌های عمومی و بخش‌های خودش را. وضعیتِ تأیید در `meta.review`
 * (JSON) است و بین دو گویشِ دیتابیس فیلترِ SQLِ یکسانی ندارد، پس تجمیع در
 * حافظه انجام می‌شود؛ فقط ستون‌های لازم خوانده می‌شوند تا ساختارِ سنگینِ فرم
 * به‌ازای هر پاسخ بار نشود.
 */
@Injectable()
export class OverviewService {
  constructor(
    @InjectRepository(ResponseEntity)
    private readonly responses: Repository<ResponseEntity>,
    @InjectRepository(FormEntity)
    private readonly forms: Repository<FormEntity>,
    @InjectRepository(DepartmentEntity)
    private readonly departments: Repository<DepartmentEntity>,
  ) {}

  async overview(
    organizationId: string,
    workspaceId: string,
    scope: OverviewScope,
    requestedDays = 30,
    now: Date = new Date(),
  ): Promise<ManagerOverview> {
    const days = Math.min(90, Math.max(7, Math.floor(requestedDays) || 30));

    const forms = (await this.forms.find({ where: { workspaceId } })).filter(
      (form) =>
        form.status !== FormStatus.ARCHIVED &&
        (scope.isManager ||
          !form.departmentId ||
          scope.departmentIds.includes(form.departmentId)),
    );

    // محورِ روزها همیشه کامل است تا نمودار حتی بدونِ داده شکلِ درست داشته باشد.
    const series: ManagerOverview['series'] = [];
    for (let i = days - 1; i >= 0; i -= 1) {
      series.push({ date: dayKey(new Date(now.getTime() - i * DAY_MS)), count: 0 });
    }
    const empty: ManagerOverview = {
      days,
      totals: { current: 0, previous: 0, changePct: null },
      review: { pending: 0, approved: 0, rejected: 0 },
      activeForms: forms.filter((f) => f.status === FormStatus.ACTIVE).length,
      series,
      byUnit: [],
      topForms: [],
    };
    if (forms.length === 0) return empty;

    const formById = new Map(forms.map((form) => [form.id, form]));
    const ids = [...formById.keys()];
    const currentStart = new Date(now.getTime() - days * DAY_MS);
    const previousStart = new Date(now.getTime() - 2 * days * DAY_MS);

    const rows = await this.responses
      .createQueryBuilder('response')
      .innerJoin('response.formVersion', 'formVersion')
      .select(['response.id', 'response.submittedAt', 'response.meta'])
      .addSelect(['formVersion.id', 'formVersion.formId'])
      .where('formVersion.formId IN (:...ids)', { ids })
      .andWhere('response.status = :status', {
        status: ResponseStatus.COMPLETED,
      })
      .andWhere('response.submittedAt >= :since', { since: previousStart })
      .getMany();

    const seriesIndex = new Map(series.map((point, i) => [point.date, i]));
    const perForm = new Map<string, number>();
    let current = 0;
    let previous = 0;
    let approved = 0;
    let rejected = 0;

    for (const row of rows) {
      if (!row.submittedAt) continue;
      const submitted = new Date(row.submittedAt);
      if (submitted < currentStart) {
        previous += 1;
        continue;
      }
      current += 1;
      const formId = row.formVersion?.formId ?? '';
      perForm.set(formId, (perForm.get(formId) ?? 0) + 1);
      const i = seriesIndex.get(dayKey(submitted));
      if (i !== undefined) series[i].count += 1;
      const status = (row.meta?.review as { status?: string } | undefined)
        ?.status;
      if (status === 'approved') approved += 1;
      else if (status === 'rejected') rejected += 1;
    }

    const pending = await this.countPending(forms);

    // تفکیکِ واحد: هر بخشی که فرم دارد، حتی با صفر گزارش (کم‌کاری هم خبر است).
    const deptNames = new Map(
      (await this.departments.find({ where: { organizationId } })).map((d) => [
        d.id,
        d.name,
      ]),
    );
    const units = new Map<string | null, number>();
    for (const form of forms) {
      const key = form.departmentId ?? null;
      units.set(key, (units.get(key) ?? 0) + (perForm.get(form.id) ?? 0));
    }
    const byUnit = [...units.entries()]
      .map(([departmentId, count]) => ({
        departmentId,
        name: departmentId
          ? (deptNames.get(departmentId) ?? 'بخشِ حذف‌شده')
          : 'عمومی',
        count,
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    const topForms = [...perForm.entries()]
      .filter(([formId, count]) => count > 0 && formById.has(formId))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([formId, count]) => ({
        formId,
        title: formById.get(formId)!.title,
        count,
      }));

    return {
      ...empty,
      totals: {
        current,
        previous,
        changePct:
          previous === 0
            ? null
            : Math.round(((current - previous) / previous) * 100),
      },
      review: { pending, approved, rejected },
      series,
      byUnit,
      topForms,
    };
  }

  /** درخواست‌های معلقِ کنونی (بی‌توجه به بازه)، فقط در فرم‌های نیازمندِ تأیید. */
  private async countPending(forms: FormEntity[]): Promise<number> {
    const ids = forms
      .filter((form) =>
        Boolean(
          (form.settings as Record<string, unknown> | undefined)
            ?.requiresApproval,
        ),
      )
      .map((form) => form.id);
    if (ids.length === 0) return 0;

    const rows = await this.responses
      .createQueryBuilder('response')
      .innerJoin('response.formVersion', 'formVersion')
      .select(['response.id', 'response.meta'])
      .where('formVersion.formId IN (:...ids)', { ids })
      .andWhere('response.status = :status', {
        status: ResponseStatus.COMPLETED,
      })
      .getMany();
    return rows.filter(
      (row) =>
        (row.meta?.review as { status?: string } | undefined)?.status ===
        'pending',
    ).length;
  }
}
