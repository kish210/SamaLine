// اسکریپت داده‌ی اولیه — بدون نیاز به هیچ ابزار بیرونی: `npm run db:seed`
import 'dotenv/config';
import { appDataSource } from './data-source';
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

async function seed() {
  const ds = await appDataSource.initialize();
  const policyRepo = ds.getRepository(PlanPolicyEntity);

  for (const [planCode, limits] of Object.entries(DEFAULT_PLAN_LIMITS)) {
    const existing = await policyRepo.findOne({
      where: { planCode: planCode as PlanCode },
    });
    if (existing) {
      existing.limits = limits;
      await policyRepo.save(existing);
      console.log(`پلن ${planCode} به‌روزرسانی شد`);
    } else {
      await policyRepo.save(
        policyRepo.create({ planCode: planCode as PlanCode, limits }),
      );
      console.log(`پلن ${planCode} ایجاد شد`);
    }
  }

  await ds.destroy();
  console.log('داده‌ی اولیه با موفقیت ثبت شد.');
}

void seed().catch((error) => {
  console.error('خطا در ثبت داده‌ی اولیه:', error);
  process.exit(1);
});
