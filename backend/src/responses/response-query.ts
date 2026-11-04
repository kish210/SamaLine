import type { Repository, SelectQueryBuilder } from 'typeorm';
import { ResponseEntity } from '../database/entities/response.entity';
import { LIKE_OPERATOR } from '../database/column-types';

/**
 * ساختِ کوئریِ پاسخ‌های یک فرم + صفحه‌بندی — مشترکِ دو مسیر.
 *
 * پیش از این، `ResponseService.listByForm` و `ReportService.filteredResponses`
 * دو نسخهٔ تقریباً یکسانِ همین کوئری بودند و هر دو بی‌صدا روی `take(500)`
 * می‌ماندند؛ یعنی پاسخِ ۵۰۱ به بعد در پنل و در خروجی دیده نمی‌شد. حالا یک
 * منبعِ حقیقت داریم: فیلترها یک‌جا ساخته می‌شوند و صفحه‌بندی/شمارش از همان
 * کوئری می‌آید.
 */

/** اندازهٔ صفحهٔ پیش‌فرض و سقفِ آن؛ بیش از این، یک درخواست کلِ جدول را می‌کشد. */
export const DEFAULT_PAGE_SIZE = 100;
export const MAX_PAGE_SIZE = 200;

/**
 * سقفِ خروجیِ اکسل.
 *
 * خروجی همیشه «همهٔ ردیف‌ها» نیست: فایلِ عظیم حافظهٔ پروسه را می‌بلعد. بالای
 * این عدد، خروجی با پیامِ روشن رد می‌شود (نه بریدنِ بی‌صدا) و کاربر بازهٔ
 * تاریخ را محدود می‌کند.
 */
export const MAX_EXPORT_ROWS = 20_000;

export interface ResponseQueryFilter {
  status?: string;
  respondentKey?: string;
  questionId?: string;
  valueText?: string;
  /** جست‌وجوی آزاد در متنِ پاسخ‌ها و کلیدِ پاسخ‌دهنده. */
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

/** کنارِ هم گذاشتنِ صفحه و اندازهٔ آن با کف/سقفِ امن. */
export function pageParams(page?: number, pageSize?: number) {
  const size = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(pageSize) || DEFAULT_PAGE_SIZE),
  );
  const current = Math.max(1, Number(page) || 1);
  return { page: current, pageSize: size, skip: (current - 1) * size };
}

/** آیا فیلترِ متنی داریم؟ (برای پیامِ خطای خروجی) */
export function hasTextFilter(filter: ResponseQueryFilter): boolean {
  return Boolean(filter.search || filter.valueText || filter.dateFrom || filter.dateTo);
}

export function buildResponseQuery(
  repo: Repository<ResponseEntity>,
  formId: string,
  filter: ResponseQueryFilter = {},
): SelectQueryBuilder<ResponseEntity> {
  const qb = repo
    .createQueryBuilder('response')
    .innerJoin('response.formVersion', 'formVersion')
    .where('formVersion.formId = :formId', { formId });

  if (filter.status) {
    qb.andWhere('response.status = :status', { status: filter.status });
  }

  if (filter.respondentKey) {
    qb.andWhere('response.respondentKey = :respondentKey', {
      respondentKey: filter.respondentKey,
    });
  }

  if (filter.dateFrom) {
    qb.andWhere('response.createdAt >= :dateFrom', {
      dateFrom: filter.dateFrom,
    });
  }

  if (filter.dateTo) {
    qb.andWhere('response.createdAt <= :dateTo', { dateTo: filter.dateTo });
  }

  /*
   * فیلترِ سوال/مقدار با EXISTS، نه JOIN.
   *
   * JOIN روی `answer_flat` برای هر پاسخِ چندپاسخی چند ردیف می‌سازد و
   * `getManyAndCount` شمارشِ اشتباه (و ردیفِ تکراری) برمی‌گرداند. EXISTS هم
   * در SQLite و هم در Postgres یک ردیف به ازای هر پاسخ می‌دهد.
   */
  if (filter.questionId || filter.valueText) {
    const parts = ['af."responseId" = response.id'];
    if (filter.questionId) parts.push('af."questionId" = :questionId');
    if (filter.valueText) {
      parts.push(`af."valueText" ${LIKE_OPERATOR} :valueText`);
    }
    qb.andWhere(`EXISTS (SELECT 1 FROM answer_flat af WHERE ${parts.join(' AND ')})`);
    if (filter.questionId) qb.setParameter('questionId', filter.questionId);
    if (filter.valueText) {
      qb.setParameter('valueText', `%${filter.valueText}%`);
    }
  }

  if (filter.search && filter.search.trim()) {
    const needle = `%${filter.search.trim()}%`;
    qb.andWhere(
      `(response.respondentKey ${LIKE_OPERATOR} :needle OR EXISTS (
        SELECT 1 FROM answer_flat af2
        WHERE af2."responseId" = response.id
          AND af2."valueText" ${LIKE_OPERATOR} :needle))`,
    );
    qb.setParameter('needle', needle);
  }

  return qb.orderBy('response.createdAt', 'DESC');
}

/** یک صفحه از پاسخ‌ها + شمارشِ کلِ ردیف‌های مطابق. */
export async function listResponsePage(
  repo: Repository<ResponseEntity>,
  formId: string,
  filter: ResponseQueryFilter & { page?: number; pageSize?: number } = {},
) {
  const { page, pageSize, skip } = pageParams(filter.page, filter.pageSize);
  const [rows, total] = await buildResponseQuery(repo, formId, filter)
    .skip(skip)
    .take(pageSize)
    .getManyAndCount();
  return { rows, total, page, pageSize };
}
