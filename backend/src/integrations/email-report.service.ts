import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { EmailReportRecipientEntity } from '../database/entities/email-report-recipient.entity';
import { FormEntity } from '../database/entities/form.entity';
import { AnalyticsService } from '../reports/analytics.service';
import { MessagingService } from '../messaging/messaging.service';
import { TenantAccessService } from '../common/tenant-access.service';
import { isoToJalaliText } from '../common/jalali';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const CHECK_INTERVAL_MS = 30 * 60 * 1000;

const PERIOD_MS: Record<'weekly' | 'monthly', number> = {
  weekly: 7 * DAY,
  monthly: 30 * DAY,
};

export interface EmailReportInput {
  formId?: string | null;
  email: string;
  label?: string;
  digest?: 'weekly' | 'monthly';
  isActive?: boolean;
}

/**
 * گزارش دوره‌ای فرم‌ها به ایمیل.
 *
 * دوقلوی نسخه‌ی تلگرام است ولی مستقل: مدیری که ایمیل را دنبال می‌کند لازم
 * نیست ربات داشته باشد. زمان‌بندی با `lastDigestAt` روی خودِ ردیف است تا
 * ری‌استارت سرور باعث ارسال دوباره یا از دست رفتن دوره نشود.
 */
@Injectable()
export class EmailReportService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailReportService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(EmailReportRecipientEntity)
    private readonly repo: Repository<EmailReportRecipientEntity>,
    @InjectRepository(FormEntity)
    private readonly formRepo: Repository<FormEntity>,
    private readonly analytics: AnalyticsService,
    private readonly messaging: MessagingService,
    private readonly tenant: TenantAccessService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.run(), CHECK_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  assertAccess(
    workspaceId: string,
    user: { sub: string; organizationId: string },
  ): Promise<void> {
    return this.tenant.assertWorkspace(workspaceId, user as never);
  }

  // ── CRUD ────────────────────────────────────────────────────────────────

  list(workspaceId: string) {
    return this.repo.find({
      where: { workspaceId },
      order: { createdAt: 'ASC' },
    });
  }

  async add(workspaceId: string, input: EmailReportInput) {
    const email = input.email.trim().toLowerCase();
    if (!isEmail(email)) throw new BadRequestException('ایمیل معتبر نیست');

    const duplicate = await this.repo.findOne({
      where: { workspaceId, email, formId: input.formId ?? IsNull() },
    });
    if (duplicate) {
      throw new BadRequestException(
        'این ایمیل برای همین فرم از قبل اضافه شده است',
      );
    }

    return this.repo.save(
      this.repo.create({
        workspaceId,
        formId: input.formId ?? null,
        email,
        label: input.label?.trim() ?? '',
        digest: input.digest === 'monthly' ? 'monthly' : 'weekly',
        isActive: input.isActive ?? true,
      }),
    );
  }

  async update(
    workspaceId: string,
    id: string,
    input: Partial<EmailReportInput>,
  ) {
    const row = await this.repo.findOne({ where: { id, workspaceId } });
    if (!row) throw new BadRequestException('گیرنده یافت نشد');

    await this.repo.update(
      { id },
      {
        label: input.label ?? row.label,
        digest: input.digest ?? row.digest,
        isActive: input.isActive ?? row.isActive,
      },
    );
    return this.repo.findOne({ where: { id } });
  }

  async remove(workspaceId: string, id: string) {
    await this.repo.delete({ id, workspaceId });
    return { ok: true };
  }

  /** ارسال فوری گزارش به یک گیرنده، بدون توجه به موعد؛ خطا را برمی‌گرداند. */
  async sendTest(workspaceId: string, id: string, now = new Date()) {
    const row = await this.repo.findOne({ where: { id, workspaceId } });
    if (!row) throw new BadRequestException('گیرنده یافت نشد');
    const ok = await this.sendDigest(row, now, false);
    if (!ok) {
      throw new BadRequestException(
        `ارسال ناموفق بود: ${row.lastError ?? 'خطای نامشخص'}`,
      );
    }
    return { ok: true };
  }

  // ── زمان‌بندی و ارسال ────────────────────────────────────────────────────

  /** یک دور بررسی موعد؛ برای تست هم قابل صدا زدن است. */
  async run(now = new Date()): Promise<number> {
    let sent = 0;
    try {
      const rows = await this.repo.find({ where: { isActive: true } });
      for (const row of rows) {
        if (this.isDue(row, now) && (await this.sendDigest(row, now))) {
          sent += 1;
        }
      }
    } catch (error) {
      this.logger.warn(
        `اجرای گزارش ایمیلی ناموفق بود: ${(error as Error).message}`,
      );
    }
    return sent;
  }

  private isDue(row: EmailReportRecipientEntity, now: Date): boolean {
    const period = PERIOD_MS[row.digest];
    if (!period) return false;
    const last = row.lastDigestAt ?? row.createdAt;
    return now.getTime() - new Date(last).getTime() >= period;
  }

  private async sendDigest(
    row: EmailReportRecipientEntity,
    now: Date,
    advanceSchedule = true,
  ): Promise<boolean> {
    const period = PERIOD_MS[row.digest];
    const from = new Date(now.getTime() - period);

    const forms = row.formId
      ? await this.formRepo.find({ where: { id: row.formId } })
      : await this.formRepo.find({ where: { workspaceId: row.workspaceId } });

    if (forms.length === 0) {
      await this.repo.update(
        { id: row.id },
        {
          lastError: 'فرمی برای گزارش نیست',
          ...(advanceSchedule ? { lastDigestAt: now } : {}),
        },
      );
      return false;
    }

    const title = row.digest === 'weekly' ? 'گزارش هفتگی' : 'گزارش ماهانه';
    const range = `${isoToJalaliText(isoDay(from))} تا ${isoToJalaliText(isoDay(now))}`;
    const sections: string[] = [];
    for (const form of forms) {
      sections.push(await this.formSection(form, from, now));
    }
    const html = this.wrapHtml(title, range, sections.join('\n'));

    const result = await this.messaging.send({
      channel: 'email',
      recipient: row.email,
      subject: `SamaLine — ${title} (${range})`,
      body: html,
    });

    const ok = result.status !== 'failed';
    await this.repo.update(
      { id: row.id },
      ok
        ? {
            ...(advanceSchedule ? { lastDigestAt: now } : {}),
            lastSentAt: now,
            lastError: null,
          }
        : {
            ...(advanceSchedule ? { lastDigestAt: now } : {}),
            lastError: (result.providerMessage ?? 'ارسال ناموفق').slice(0, 300),
          },
    );
    return ok;
  }

  private async formSection(
    form: FormEntity,
    from: Date,
    to: Date,
  ): Promise<string> {
    try {
      const data = await this.analytics.forForm(form.id, {
        from: isoDay(from),
        to: isoDay(to),
      });

      const rows: string[] = [
        `<tr><td style="padding:6px 0;font-weight:bold">پاسخ تکمیل‌شده</td><td style="padding:6px 0">${data.totalResponses}</td></tr>`,
      ];
      for (const score of data.scores) {
        const rate = score.rate === null ? '' : ` (${score.rate}٪)`;
        rows.push(
          `<tr><td style="padding:6px 0">${escapeHtml(score.key)}</td><td style="padding:6px 0">${score.average}${rate}</td></tr>`,
        );
      }

      const worst = data.questions
        .filter((q) => q.average !== null && q.answered > 0)
        .sort((a, b) => (a.average ?? 0) - (b.average ?? 0))
        .slice(0, 3);
      for (const q of worst) {
        rows.push(
          `<tr><td style="padding:6px 0;color:#b4531f">کمترین: ${escapeHtml(q.title)}</td><td style="padding:6px 0;color:#b4531f">${q.average}</td></tr>`,
        );
      }

      return `
        <h3 style="margin:18px 0 6px">${escapeHtml(form.title)}</h3>
        <table style="width:100%;border-collapse:collapse;font-size:14px">${rows.join('')}</table>`;
    } catch (error) {
      this.logger.warn(
        `ساخت گزارش فرم ${form.id} ناموفق بود: ${(error as Error).message}`,
      );
      return `<h3 style="margin:18px 0 6px">${escapeHtml(form.title)}</h3><p>گزارش این فرم ساخته نشد.</p>`;
    }
  }

  private wrapHtml(title: string, range: string, inner: string): string {
    return `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"></head>
<body style="font-family:Tahoma,Arial,sans-serif;background:#f5f6f8;margin:0;padding:24px">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;padding:24px;color:#1f2430">
    <h2 style="margin:0 0 4px">📊 ${escapeHtml(title)}</h2>
    <p style="margin:0 0 12px;color:#6b7280">${escapeHtml(range)}</p>
    ${inner}
    <p style="margin-top:24px;color:#9aa0a6;font-size:12px">این گزارش به‌صورت خودکار از SamaLine فرستاده شده است.</p>
  </div>
</body></html>`;
  }
}

function isoDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
