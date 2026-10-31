import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import type { DashboardWidget } from '../database/entities/dashboard.entity';
import { DepartmentsService } from '../departments/departments.service';
import { FormService } from '../forms/form.service';
import { DashboardService } from '../reports/dashboard.service';
import { PortalService } from '../public/portal.service';
import { findTemplate } from '../templates/form-templates';

/**
 * واحدهای استانداردِ هتل و فرمِ عملیاتیِ هر کدام.
 *
 * کلیدها همان «کلیدِ ماشینیِ» بخش‌اند (`departments.key`) و قالب‌ها همان
 * قالب‌های عملیاتیِ فاز B؛ این‌جا فقط به هم وصل می‌شوند.
 */
export const STANDARD_UNITS = [
  { key: 'technical', name: 'فنی', template: 'ops-technical-daily' },
  { key: 'housekeeping', name: 'خانه‌داری', template: 'ops-housekeeping-room' },
  { key: 'hr', name: 'منابع انسانی', template: 'ops-hr-request' },
  { key: 'it', name: 'IT', template: 'ops-it-incident' },
  { key: 'contractors', name: 'پیمانکاران', template: 'ops-contractor-visit' },
] as const;

export interface UnitSetupResult {
  key: string;
  name: string;
  departmentId: string;
  department: 'created' | 'existing';
  form: 'created' | 'existing' | 'skipped';
  dashboard: 'created' | 'existing' | 'repaired';
  portal: 'created' | 'existing' | 'skipped';
  /** دلیلِ ساخته نشدنِ فرم (مثلا سقفِ پلن). */
  note?: string;
}

/**
 * راه‌اندازیِ یک‌کلیکیِ واحدهای هتل: بخش + فرمِ عملیاتیِ آن بخش + داشبوردِ
 * همان بخش.
 *
 * پیش از این بخش‌ها فقط دستی ساخته می‌شدند؛ سازمانی که هیچ بخشی نساخته بود
 * نه «بخشِ فنی» داشت نه داشبوردِ واحد. اجرای دوباره بی‌خطر است: هرچه از قبل
 * هست (بخش با همان کلید، فرم یا داشبوردِ آن بخش) دست نمی‌خورد و فقط کمبودها
 * ساخته می‌شوند. فرم‌ها پیش‌نویس ساخته می‌شوند تا مدیر پیش از انتشار ببیند.
 */
@Injectable()
export class HotelSetupService {
  private readonly logger = new Logger(HotelSetupService.name);

  constructor(
    private readonly departments: DepartmentsService,
    private readonly forms: FormService,
    private readonly dashboards: DashboardService,
    private readonly portals: PortalService,
  ) {}

  async setupStandardUnits(
    organizationId: string,
    workspaceId: string,
  ): Promise<UnitSetupResult[]> {
    const existingDepts = await this.departments.list(organizationId);
    const workspaceForms = await this.forms.list(workspaceId, true);
    const orgDashboards = await this.dashboards.list(organizationId);
    const existingPortals = await this.portals.list(workspaceId);

    const results: UnitSetupResult[] = [];
    for (const unit of STANDARD_UNITS) {
      const found = existingDepts.find((d) => d.key === unit.key);
      const deptState: UnitSetupResult['department'] = found
        ? 'existing'
        : 'created';
      const deptId = found
        ? found.id
        : (
            await this.departments.create(organizationId, {
              name: unit.name,
              key: unit.key,
            })
          ).id;

      // فرمِ عملیاتیِ همین بخش؛ اگر بخش از قبل فرمی دارد، دست نمی‌زنیم.
      let formState: UnitSetupResult['form'] = 'existing';
      let formId = workspaceForms.find((f) => f.departmentId === deptId)?.id;
      let note: string | undefined;
      if (!formId) {
        const template = findTemplate(unit.template);
        try {
          const created = await this.forms.create({
            workspaceId,
            title: template?.title ?? `گزارشِ ${unit.name}`,
            slug: `${unit.key}-${randomBytes(3).toString('hex')}`,
            templateKey: unit.template,
            departmentId: deptId,
          } as Parameters<FormService['create']>[0]);
          formId = (created as { id?: string }).id;
          formState = 'created';
        } catch (error) {
          // سقفِ پلن یا قالبِ نامعتبر نباید کلِ راه‌اندازی را بشکند.
          formState = 'skipped';
          note = (error as Error).message;
          this.logger.warn(`فرمِ ${unit.key} ساخته نشد: ${note}`);
        }
      }

      let dashState: UnitSetupResult['dashboard'] = 'existing';
      const existingDash = orgDashboards.find((d) => d.departmentId === deptId);
      if (!existingDash) {
        const dashboard = await this.dashboards.create(
          organizationId,
          `داشبوردِ واحدِ ${unit.name}`,
          deptId,
        );
        await this.dashboards.update(organizationId, dashboard.id, {
          widgets: unitWidgets(unit.name, formId),
        });
        dashState = 'created';
      } else if (formId) {
        /*
         * تعمیر: داشبوردِ واحد از قبل هست ولی اگر ویجتِ آماری formId نداشته باشد
         * (داشبورد پیش از ساختِ فرمِ واحد ساخته شده)، آمار هرگز پر نمی‌شود.
         * formId را روی همان ویجت‌ها می‌گذاریم، بدونِ پاک‌کردنِ سفارشی‌سازیِ مدیر.
         */
        const widgets = (existingDash.widgets ?? []) as DashboardWidget[];
        const needsRepair = widgets.some((w) => w.type === 'stat' && !w.formId);
        if (needsRepair) {
          const repaired = widgets.map((w) =>
            w.type === 'stat' && !w.formId ? { ...w, formId } : w,
          );
          await this.dashboards.update(organizationId, existingDash.id, {
            widgets: repaired,
          });
          dashState = 'repaired';
        }
      }

      // پرتالِ واحد: فرمِ همین واحد را برای کارکنانِ همان بخش عمومی می‌کند.
      // پیش از این setup پرتال نمی‌ساخت، پس پرتالِ واحد همیشه خالی بود.
      let portalState: UnitSetupResult['portal'] = 'existing';
      if (!existingPortals.some((p) => p.departmentId === deptId)) {
        try {
          await this.portals.save(workspaceId, null, {
            slug: `${unit.key}-${randomBytes(3).toString('hex')}`,
            title: `پرتالِ واحدِ ${unit.name}`,
            departmentId: deptId,
            formIds: formId ? [formId] : [],
          });
          portalState = 'created';
        } catch (error) {
          // سقفِ پلن نباید کلِ راه‌اندازی را بشکند.
          portalState = 'skipped';
          note = note ?? (error as Error).message;
          this.logger.warn(`پرتالِ ${unit.key} ساخته نشد: ${(error as Error).message}`);
        }
      }

      results.push({
        key: unit.key,
        name: unit.name,
        departmentId: deptId,
        department: deptState,
        form: formState,
        dashboard: dashState,
        portal: portalState,
        ...(note ? { note } : {}),
      });
    }
    return results;
  }

  /**
   * ساختِ خودکارِ داشبورد + پرتال برای یک فرمِ موجود (مثلاً فرمِ ساخته‌شده با AI).
   * داشبورد ویجتِ آمار + یک نمودار برای هر سوالِ نمودارپذیر می‌گیرد؛ پرتال همان
   * فرم را دارد. هر دو بخشِ همان فرم را می‌گیرند (اگر فرم بخشی باشد).
   */
  async autoBuildForForm(organizationId: string, formId: string) {
    const form = (await this.forms.get(formId)) as {
      title: string;
      workspaceId: string;
      departmentId: string | null;
      latestVersion?: { structure?: { pages?: Array<{ questions?: Array<{ id: string; title?: string; type?: string }> }> } };
    };
    const title = form.title || 'فرم';
    const departmentId = form.departmentId ?? null;
    const questions = (form.latestVersion?.structure?.pages ?? []).flatMap(
      (p) => p.questions ?? [],
    );

    const dashboard = await this.dashboards.create(
      organizationId,
      `داشبوردِ ${title}`,
      departmentId,
    );
    await this.dashboards.update(organizationId, dashboard.id, {
      widgets: reportWidgets(title, formId, questions),
    });

    let portalSlug: string | null = null;
    /*
     * دلیلِ نساختنِ پرتال هم برمی‌گردد.
     *
     * پیش از این فقط لاگِ هشدار می‌شد و پنل `null` می‌گرفت؛ کاربر می‌دید
     * «داشبورد و پرتالِ خودکار» را زده ولی پرتالی نیست و هیچ توضیحی هم ندارد
     * (معمولاً سقفِ پرتالِ پلن پر است). حالا پنل می‌تواند علت را بگوید.
     */
    let portalError: string | null = null;
    try {
      const portal = await this.portals.save(form.workspaceId, null, {
        slug: `rep-${randomBytes(3).toString('hex')}`,
        title: `پرتالِ ${title}`,
        departmentId,
        formIds: [formId],
      });
      portalSlug = portal.slug;
    } catch (error) {
      portalError = (error as Error).message;
      this.logger.warn(`پرتالِ خودکار ساخته نشد: ${portalError}`);
    }

    return { dashboardId: dashboard.id, portalSlug, portalError };
  }
}

/** انواعِ سوالی که روی داشبورد نمودارپذیرند و نوعِ ویجتشان. */
const CHART_WIDGET: Record<string, 'bar' | 'nps'> = {
  multiple_choice: 'bar',
  dropdown: 'bar',
  boolean: 'bar',
  emoji: 'bar',
  image_choice: 'bar',
  rating: 'bar',
  slider: 'bar',
  number: 'bar',
  nps: 'nps',
};

/** ویجت‌های داشبوردِ یک فرم: متنِ عنوان + آمار + یک نمودار برای هر سوالِ نمودارپذیر. */
function reportWidgets(
  title: string,
  formId: string,
  questions: Array<{ id: string; title?: string; type?: string }>,
): DashboardWidget[] {
  const id = () => randomBytes(6).toString('hex');
  const widgets: DashboardWidget[] = [
    {
      id: id(),
      type: 'text',
      title,
      content: `گزارشِ خودکارِ فرمِ «${title}».`,
      layout: { x: 0, y: 0, w: 12, h: 1 },
    },
    {
      id: id(),
      type: 'stat',
      title: 'پاسخ‌های کامل',
      formId,
      metric: 'completed',
      layout: { x: 0, y: 1, w: 4, h: 2 },
    },
  ];
  let y = 3;
  for (const q of questions) {
    const widgetType = CHART_WIDGET[q.type ?? ''];
    if (!widgetType) continue;
    widgets.push({
      id: id(),
      type: widgetType,
      title: q.title || q.id,
      formId,
      questionId: q.id,
      layout: { x: 0, y, w: 12, h: 3 },
    });
    y += 3;
  }
  return widgets;
}

/** ویجت‌های آغازینِ داشبوردِ یک واحد؛ مدیر بعدا ویرایششان می‌کند. */
function unitWidgets(unitName: string, formId?: string): DashboardWidget[] {
  const id = () => randomBytes(6).toString('hex');
  const widgets: DashboardWidget[] = [
    {
      id: id(),
      type: 'text',
      title: `واحدِ ${unitName}`,
      content: `گزارش‌های عملیاتیِ واحدِ ${unitName} اینجا جمع می‌شود. فرمِ این واحد را از «فرم‌ها» منتشر کنید تا آمار پر شود.`,
      layout: { x: 0, y: 0, w: 12, h: 2 },
    },
  ];
  if (formId) {
    widgets.push(
      {
        id: id(),
        type: 'stat',
        title: 'گزارش‌های ثبت‌شده',
        formId,
        metric: 'completed',
        layout: { x: 0, y: 2, w: 4, h: 2 },
      },
      {
        id: id(),
        type: 'stat',
        title: 'شروع‌شده',
        formId,
        metric: 'started',
        layout: { x: 4, y: 2, w: 4, h: 2 },
      },
      {
        id: id(),
        type: 'stat',
        title: 'نرخِ تکمیل',
        formId,
        metric: 'completionRate',
        layout: { x: 8, y: 2, w: 4, h: 2 },
      },
    );
  }
  return widgets;
}
