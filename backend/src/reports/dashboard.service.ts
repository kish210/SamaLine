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
  /** ردیف‌های ویجتِ جدول؛ `responseId` برای رفتن به خودِ پاسخ. */
  rows?: Array<{
    responseId: string;
    submittedAt: string | null;
    score?: number | null;
    summary: string;
  }>;
  /** نظرهای متنیِ اخیر. */
  quotes?: Array<{ responseId: string; text: string; at: string | null }>;
  /**
   * تغییر نسبت به نیمهٔ اولِ همین بازه (درصد).
   *
   * برای ویجتِ روند؛ بدونِ آن کاربر نمودار را می‌بیند ولی نمی‌داند بهتر
   * شده یا بدتر.
   */
  changePercent?: number | null;
}

/** بازه‌ی زمانیِ داشبورد؛ خالی یعنی از ابتدا. */
export interface DashboardRange {
  from?: string;
  to?: string;
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
  async render(organizationId: string, id: string, range: DashboardRange = {}) {
    const dashboard = await this.get(organizationId, id);
    return this.renderWidgets(dashboard, range);
  }

  /** نمای عمومی با توکن اشتراک، بدون نیاز به ورود. */
  async renderPublic(publicToken: string, range: DashboardRange = {}) {
    const dashboard = await this.dashboardRepo.findOne({
      where: { publicToken },
    });
    if (!dashboard || !dashboard.isPublic) {
      throw new NotFoundException('داشبورد عمومی یافت نشد');
    }
    return this.renderWidgets(dashboard, range);
  }

  private async renderWidgets(
    dashboard: DashboardEntity,
    range: DashboardRange = {},
  ) {
    const widgets: WidgetData[] = [];

    for (const widget of dashboard.widgets ?? []) {
      widgets.push(await this.renderWidget(widget, range));
    }

    return {
      id: dashboard.id,
      name: dashboard.name,
      isPublic: dashboard.isPublic,
      publicToken: dashboard.publicToken,
      range,
      widgets,
    };
  }

  private async renderWidget(
    widget: DashboardWidget,
    range: DashboardRange = {},
  ): Promise<WidgetData> {
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

      if (widget.type === 'trend') {
        if (!widget.formId) throw new Error('فرم انتخاب نشده است');
        return { ...base, ...(await this.trend(widget, range)) };
      }

      if (widget.type === 'table') {
        if (!widget.formId) throw new Error('فرم انتخاب نشده است');
        return { ...base, rows: await this.recentRows(widget, range) };
      }

      if (widget.type === 'verbatim') {
        if (!widget.formId || !widget.questionId) {
          throw new Error('فرم یا سوال انتخاب نشده است');
        }
        return { ...base, quotes: await this.verbatims(widget, range) };
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

  /**
   * پاسخ‌های تکمیل‌شده‌ی یک فرم، محدود به بازه.
   *
   * فیلتر در حافظه است چون `completedResponses` همین الان هم همه را می‌آورد
   * و ویجت‌ها روی یک فرم کار می‌کنند؛ کوئریِ تازه ارزشِ پیچیدگی‌اش را ندارد.
   */
  private async responsesInRange(formId: string, range: DashboardRange) {
    const rows = await this.reports.completedResponses(formId);
    const from = range.from ? Date.parse(`${range.from}T00:00:00Z`) : null;
    const to = range.to ? Date.parse(`${range.to}T23:59:59Z`) : null;
    return rows
      .filter((r) => {
        const at = r.submittedAt ? new Date(r.submittedAt).getTime() : null;
        if (at === null) return from === null && to === null;
        if (from !== null && at < from) return false;
        if (to !== null && at > to) return false;
        return true;
      })
      .sort((a, b) => {
        const x = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
        const y = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
        return y - x;
      });
  }

  /**
   * روندِ تعدادِ پاسخ در گامِ زمانی + درصدِ تغییر.
   *
   * تغییر، نیمهٔ دومِ بازه را با نیمهٔ اول می‌سنجد؛ ساده و بی‌نیاز به تنظیم،
   * و همان چیزی که مدیر می‌پرسد: «بهتر شده یا بدتر؟»
   */
  private async trend(widget: DashboardWidget, range: DashboardRange) {
    const rows = await this.responsesInRange(widget.formId!, range);
    const interval = widget.interval ?? 'day';

    /** کلیدِ سطلِ زمانی برای یک تاریخ. */
    const bucketOf = (iso: string): string => {
      const d = new Date(iso);
      if (interval === 'month') return iso.slice(0, 7);
      if (interval === 'week') {
        // شنبه‌ی همان هفته (هفته‌ی ایرانی از شنبه شروع می‌شود).
        const day = (d.getUTCDay() + 1) % 7;
        const start = new Date(d.getTime() - day * 86400000);
        return start.toISOString().slice(0, 10);
      }
      return iso.slice(0, 10);
    };

    const counts = new Map<string, number>();
    for (const r of rows) {
      if (!r.submittedAt) continue;
      const key = bucketOf(new Date(r.submittedAt).toISOString());
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const series = [...counts.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([label, count]) => ({ label, count }));

    let changePercent: number | null = null;
    if (series.length >= 2) {
      const half = Math.floor(series.length / 2);
      const first = series
        .slice(0, half)
        .reduce((s, p) => s + p.count, 0);
      const second = series.slice(half).reduce((s, p) => s + p.count, 0);
      // از صفر نمی‌شود درصد گرفت؛ آنجا «تغییر نامشخص» درست‌تر از عددِ ساختگی است.
      changePercent =
        first > 0 ? Math.round(((second - first) / first) * 100) : null;
    }

    return { series, value: rows.length, changePercent };
  }

  /** چند پاسخِ اخیر با خلاصه‌ای از محتوا؛ هر ردیف به خودِ پاسخ می‌رسد. */
  private async recentRows(widget: DashboardWidget, range: DashboardRange) {
    const limit = Math.min(Math.max(widget.limit ?? 10, 1), 50);
    const rows = await this.responsesInRange(widget.formId!, range);

    return rows.slice(0, limit).map((r) => {
      const answers = (r.answers ?? {}) as Record<string, unknown>;
      // خلاصه: اولین چند پاسخِ متنی، تا ردیف بی‌معنا نباشد.
      const summary = Object.values(answers)
        .filter((v) => typeof v === 'string' && v.trim())
        .slice(0, 2)
        .join(' · ')
        .slice(0, 120);
      const scores = (r.scores ?? {}) as Record<string, unknown>;
      const firstScore = Object.values(scores).find(
        (v) => typeof v === 'number',
      );
      return {
        responseId: r.id,
        submittedAt: r.submittedAt
          ? new Date(r.submittedAt).toISOString()
          : null,
        score: typeof firstScore === 'number' ? firstScore : null,
        summary: summary || '—',
      };
    });
  }

  /** نظرهای متنیِ اخیر برای یک سوال. */
  private async verbatims(widget: DashboardWidget, range: DashboardRange) {
    const limit = Math.min(Math.max(widget.limit ?? 10, 1), 50);
    const rows = await this.responsesInRange(widget.formId!, range);
    const out: Array<{
      responseId: string;
      text: string;
      at: string | null;
    }> = [];

    for (const r of rows) {
      const raw = (r.answers ?? {})[widget.questionId!];
      const text = typeof raw === 'string' ? raw.trim() : '';
      if (!text) continue;
      out.push({
        responseId: r.id,
        text: text.slice(0, 400),
        at: r.submittedAt ? new Date(r.submittedAt).toISOString() : null,
      });
      if (out.length >= limit) break;
    }
    return out;
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
