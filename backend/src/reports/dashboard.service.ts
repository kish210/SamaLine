import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'node:crypto';
import { Repository } from 'typeorm';
import {
  DashboardEntity,
  type DashboardWidget,
} from '../database/entities/dashboard.entity';
import { FormEntity } from '../database/entities/form.entity';
import { WorkspaceEntity } from '../database/entities/workspace.entity';
import { ReportService } from './report.service';

/** داده‌ی محاسبه‌شده‌ی یک ویجت برای نمایش. */
export interface WidgetData {
  id: string;
  type: DashboardWidget['type'];
  title: string;
  layout: DashboardWidget['layout'];
  value?: number | string;
  series?: Array<{ label: string; count: number }>;
  content?: string;
  error?: string;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(DashboardEntity)
    private readonly dashboardRepo: Repository<DashboardEntity>,
    @InjectRepository(FormEntity)
    private readonly formRepo: Repository<FormEntity>,
    @InjectRepository(WorkspaceEntity)
    private readonly workspaceRepo: Repository<WorkspaceEntity>,
    private readonly reports: ReportService,
  ) {}

  create(organizationId: string, name: string, departmentId?: string | null) {
    return this.dashboardRepo.save(
      this.dashboardRepo.create({
        organizationId,
        name,
        departmentId: departmentId || null,
        widgets: [],
        isPublic: false,
        publicToken: null,
      }),
    );
  }

  /**
   * داشبوردهای سازمان.
   *
   * کارمندِ غیرمدیر فقط داشبوردهای عمومی و داشبوردهای بخش‌های خودش را
   * می‌بیند؛ داشبوردِ یک بخش می‌تواند عددهای همان بخش را نشان دهد.
   */
  async list(
    organizationId: string,
    scope?: { departmentIds: string[]; isManager: boolean },
  ) {
    const all = await this.dashboardRepo.find({
      where: { organizationId },
      order: { createdAt: 'DESC' },
    });
    if (!scope || scope.isManager) return all;
    return all.filter(
      (dashboard) =>
        !dashboard.departmentId ||
        scope.departmentIds.includes(dashboard.departmentId),
    );
  }

  async get(organizationId: string, id: string) {
    const dashboard = await this.dashboardRepo.findOne({
      where: { id, organizationId },
    });
    if (!dashboard) throw new NotFoundException('داشبورد یافت نشد');
    return dashboard;
  }

  async update(
    organizationId: string,
    id: string,
    patch: {
      name?: string;
      widgets?: DashboardWidget[];
      departmentId?: string | null;
    },
  ) {
    const dashboard = await this.get(organizationId, id);

    if (patch.widgets) {
      await this.assertFormsBelongToOrganization(organizationId, patch.widgets);
      dashboard.widgets = patch.widgets;
    }
    if (patch.name) dashboard.name = patch.name;
    if (patch.departmentId !== undefined) {
      dashboard.departmentId = patch.departmentId || null;
    }

    return this.dashboardRepo.save(dashboard);
  }

  async remove(organizationId: string, id: string) {
    const dashboard = await this.get(organizationId, id);
    await this.dashboardRepo.remove(dashboard);
    return { deleted: true };
  }

  /**
   * روشن یا خاموش کردن اشتراک عمومی.
   * توکن با هر بار روشن کردن تازه ساخته می‌شود تا لینک قدیمی که
   * جایی درز کرده دوباره کار نکند.
   */
  async setPublic(organizationId: string, id: string, isPublic: boolean) {
    const dashboard = await this.get(organizationId, id);

    dashboard.isPublic = isPublic;
    dashboard.publicToken = isPublic ? randomBytes(16).toString('hex') : null;

    const saved = await this.dashboardRepo.save(dashboard);
    return { isPublic: saved.isPublic, publicToken: saved.publicToken };
  }

  /** داده‌ی همه‌ی ویجت‌های یک داشبورد. */
  async render(organizationId: string, id: string) {
    const dashboard = await this.get(organizationId, id);
    return this.renderWidgets(dashboard);
  }

  /** نمای عمومی با توکن اشتراک، بدون نیاز به ورود. */
  async renderPublic(publicToken: string) {
    const dashboard = await this.dashboardRepo.findOne({
      where: { publicToken },
    });
    if (!dashboard || !dashboard.isPublic) {
      throw new NotFoundException('داشبورد عمومی یافت نشد');
    }
    return this.renderWidgets(dashboard);
  }

  private async renderWidgets(dashboard: DashboardEntity) {
    const widgets: WidgetData[] = [];

    for (const widget of dashboard.widgets ?? []) {
      widgets.push(await this.renderWidget(widget));
    }

    return {
      id: dashboard.id,
      name: dashboard.name,
      isPublic: dashboard.isPublic,
      publicToken: dashboard.publicToken,
      widgets,
    };
  }

  private async renderWidget(widget: DashboardWidget): Promise<WidgetData> {
    const base: WidgetData = {
      id: widget.id,
      type: widget.type,
      title: widget.title,
      layout: widget.layout,
    };

    try {
      if (widget.type === 'text') {
        return { ...base, content: widget.content ?? '' };
      }

      if (widget.type === 'stat') {
        if (!widget.formId) throw new Error('فرم انتخاب نشده است');
        const summary = await this.reports.formSummary(widget.formId);
        const metric = widget.metric ?? 'completed';
        return { ...base, value: summary[metric as keyof typeof summary] ?? 0 };
      }

      if (widget.type === 'bar' || widget.type === 'nps') {
        if (!widget.questionId) throw new Error('سوال انتخاب نشده است');
        const series = await this.reports.questionBreakdown(widget.questionId);

        if (widget.type === 'nps') {
          return { ...base, value: computeNps(series), series };
        }
        return { ...base, series };
      }

      if (widget.type === 'score') {
        if (!widget.formId || !widget.scoreKey) {
          throw new Error('فرم یا شاخص انتخاب نشده است');
        }
        return {
          ...base,
          value: await this.averageScore(widget.formId, widget.scoreKey),
        };
      }

      return { ...base, error: 'نوع ویجت پشتیبانی نمی‌شود' };
    } catch (error) {
      // خطای یک ویجت نباید کل داشبورد را خالی کند.
      return {
        ...base,
        error: error instanceof Error ? error.message : 'خطا در محاسبه',
      };
    }
  }

  /** میانگین یک شاخص روی پاسخ‌های تکمیل‌شده‌ی فرم. */
  private async averageScore(formId: string, scoreKey: string) {
    const responses = await this.reports.completedResponses(formId);
    const values = responses
      .map((response) => response.scores?.[scoreKey])
      .filter((value): value is number => typeof value === 'number');

    if (!values.length) return 0;
    const sum = values.reduce((a, b) => a + b, 0);
    return Number((sum / values.length).toFixed(2));
  }

  /**
   * ویجت‌ها فقط می‌توانند به فرم‌های همان سازمان اشاره کنند، وگرنه
   * می‌شد با ساختن ویجت، داده‌ی سازمان دیگری را خواند.
   */
  private async assertFormsBelongToOrganization(
    organizationId: string,
    widgets: DashboardWidget[],
  ) {
    const formIds = [
      ...new Set(
        widgets.map((w) => w.formId).filter((id): id is string => !!id),
      ),
    ];
    if (!formIds.length) return;

    const workspaces = await this.workspaceRepo.find({
      where: { organizationId },
      select: { id: true },
    });
    const allowed = new Set(workspaces.map((w) => w.id));

    for (const formId of formIds) {
      const form = await this.formRepo.findOne({ where: { id: formId } });
      if (!form || !allowed.has(form.workspaceId)) {
        throw new BadRequestException(
          'ویجت به فرمی خارج از سازمان شما اشاره می‌کند',
        );
      }
    }
  }
}

/** شاخص NPS: درصد ترویج‌کننده منهای درصد مخالف (بند ۱۱ سند). */
export function computeNps(series: Array<{ label: string; count: number }>) {
  let promoters = 0;
  let detractors = 0;
  let total = 0;

  for (const item of series) {
    const score = Number(item.label);
    if (!Number.isFinite(score)) continue;
    total += item.count;
    if (score >= 9) promoters += item.count;
    else if (score <= 6) detractors += item.count;
  }

  if (!total) return 0;
  return Number((((promoters - detractors) / total) * 100).toFixed(1));
}
