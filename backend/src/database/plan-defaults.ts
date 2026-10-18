import { Logger } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { PlanCode, PlanPolicyEntity } from './entities/plan-policy.entity';

/**
 * سیاست پیش‌فرض پلن‌ها مطابق جدول بخش ۹ سند محصول.
 * قابل تغییر از دیتابیس؛ این مقادیر فقط نقطه‌ی شروع‌اند.
 */
export const DEFAULT_PLAN_LIMITS: Record<PlanCode, Record<string, unknown>> = {
  [PlanCode.FREE]: {
    activeForms: 1,
    responsesPerMonth: 200,
    maxQuestionTypes: 10,
    workspaceUsers: 1,
    logicDisplay: false,
    logicSkip: false,
    indices: 0,
    multiLanguage: false,
    smsPanel: false,
    emailPanel: false,
    embed: false,
    kiosk: 0,
    interviewer: 0,
    portal: 0,
    webhooks: 0,
    dashboards: 0,
    api: false,
    advancedExcel: false,
    powerpointExport: false,
    customDomain: false,
    aiCreate: true,
    aiReview: true,
    aiAnalyze: false,
  },
  [PlanCode.PRO]: {
    activeForms: 5,
    responsesPerMonth: 1000,
    maxQuestionTypes: 12,
    workspaceUsers: 1,
    logicDisplay: true,
    logicSkip: false,
    indices: 0,
    multiLanguage: true,
    smsPanel: false,
    emailPanel: false,
    embed: false,
    kiosk: 0,
    interviewer: 0,
    portal: 0,
    webhooks: 0,
    dashboards: 0,
    api: false,
    advancedExcel: false,
    powerpointExport: false,
    customDomain: false,
    aiCreate: true,
    aiReview: true,
    aiAnalyze: false,
  },
  [PlanCode.ORG]: {
    activeForms: 10,
    responsesPerMonth: -1,
    maxQuestionTypes: 16,
    workspaceUsers: 1,
    logicDisplay: true,
    logicSkip: true,
    indices: 1,
    multiLanguage: true,
    smsPanel: true,
    emailPanel: true,
    embed: true,
    kiosk: 1,
    interviewer: 1,
    portal: 0,
    webhooks: 1,
    dashboards: 0,
    api: false,
    advancedExcel: true,
    powerpointExport: false,
    customDomain: false,
    aiCreate: true,
    aiReview: true,
    aiAnalyze: false,
  },
  [PlanCode.ENTERPRISE]: {
    activeForms: -1,
    responsesPerMonth: -1,
    maxQuestionTypes: 24,
    workspaceUsers: 5,
    logicDisplay: true,
    logicSkip: true,
    indices: 5,
    multiLanguage: true,
    smsPanel: true,
    emailPanel: true,
    embed: true,
    kiosk: 5,
    interviewer: 5,
    portal: 5,
    webhooks: 5,
    dashboards: 5,
    api: true,
    advancedExcel: true,
    powerpointExport: true,
    customDomain: true,
    aiCreate: true,
    aiReview: true,
    aiAnalyze: true,
  },
};

/**
 * ثبت پلن‌های پیش‌فرض.
 *
 * - `overwrite: false` (هنگام بالا آمدن برنامه): فقط پلن‌های ناموجود ساخته
 *   می‌شوند. سقف‌هایی که گرداننده در دیتابیس عوض کرده دست نمی‌خورند.
 * - `overwrite: true` (دستور `npm run db:seed`): همه به مقدار پیش‌فرض
 *   برمی‌گردند.
 *
 * پیش از این پلن‌ها فقط با اجرای دستی seed ساخته می‌شدند و اسکریپت
 * استقرار آن را اجرا نمی‌کرد؛ نصب تازه هیچ سیاست پلنی نداشت.
 */
export async function ensureDefaultPlans(
  ds: DataSource,
  options: { overwrite: boolean },
): Promise<string[]> {
  const repo = ds.getRepository(PlanPolicyEntity);
  const changed: string[] = [];

  for (const [planCode, limits] of Object.entries(DEFAULT_PLAN_LIMITS)) {
    const code = planCode as PlanCode;
    const existing = await repo.findOne({ where: { planCode: code } });
    if (!existing) {
      await repo.save(repo.create({ planCode: code, limits }));
      changed.push(code);
    } else if (options.overwrite) {
      existing.limits = limits;
      await repo.save(existing);
      changed.push(code);
    }
  }

  if (changed.length && !options.overwrite) {
    new Logger('PlanDefaults').log(
      `پلن‌های پیش‌فرض ساخته شد: ${changed.join('، ')}`,
    );
  }
  return changed;
}
