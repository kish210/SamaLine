import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';

const run = promisify(execFile);

/** کارهایی که روی سرویس مجاز است. هیچ‌چیز دیگری پذیرفته نمی‌شود. */
export const SERVICE_ACTIONS = ['start', 'stop', 'restart'] as const;
export type ServiceAction = (typeof SERVICE_ACTIONS)[number];

export interface ServiceStatus {
  /** نام واحد systemd، بدون پسوند .service. */
  name: string;
  description: string;
  /** active / inactive / failed / activating / … */
  activeState: string;
  subState: string;
  /** آیا این همان سرویسی است که خودِ این پنل را سرو می‌کند؟ */
  isSelf: boolean;
  /** لحظه‌ی فعال شدن (ISO) یا null. */
  since: string | null;
  /** مصرف حافظه به بایت، یا null اگر در دسترس نبود. */
  memoryBytes: number | null;
}

/** خروجی اجرای یک فرمان کنترل. */
export interface ControlResult {
  ok: boolean;
  message: string;
}

/**
 * پایش و کنترل سرویس‌های systemdِ مربوط به همین سامانه.
 *
 * چند خط قرمزِ امنیتی، چون این کد با دسترسی root اجرا می‌شود:
 *
 * ۱. فهرست سرویس‌ها یک allowlist است که فقط از متغیر محیطی می‌آید، نه از
 *    درخواست. نامِ واحد هرگز از بدنه/کوئری کاربر گرفته نمی‌شود؛ کاربر فقط
 *    می‌تواند یکی از همین نام‌های از پیش‌تعریف‌شده را انتخاب کند.
 * ۲. فرمان‌ها با execFile اجرا می‌شوند نه exec؛ پس هیچ رشته‌ای به پوسته
 *    تفسیر نمی‌شود و امکان تزریق فرمان نیست.
 * ۳. فقط سه کارِ start/stop/restart. چیز دیگری (مثلا mask یا enable) نه.
 *
 * دسترسی سطح‌بالا (فقط سوپرادمین) با گاردِ کنترلر تضمین می‌شود، نه اینجا.
 */
@Injectable()
export class ServiceControlService {
  private readonly logger = new Logger(ServiceControlService.name);

  /**
   * نامِ واحدی که خودِ این فرایند را سرو می‌کند.
   *
   * برای هشدار دادن در پنل: ری‌استارت کردنش یعنی قطع کوتاهِ همین پنل، و
   * stop کردنش یعنی پنل دیگر بالا نمی‌آید تا خودش را روشن کند.
   */
  private readonly selfUnit = process.env.SELF_SERVICE_UNIT ?? 'samaline';

  /** allowlist نام‌های واحد؛ فقط از محیط. */
  private readonly managed = this.parseManaged();

  private parseManaged(): string[] {
    const raw = process.env.MANAGED_SERVICES ?? 'samaline';
    const names = raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      // نامِ واحد systemd کاراکترهای محدودی دارد؛ هرچه غیر از این‌ها، رد.
      .filter((s) => /^[A-Za-z0-9@._-]+$/.test(s));
    // بدون تکرار، و همیشه شامل خودِ سرویس تا کاربر بتواند ری‌استارتش کند.
    return [...new Set([this.selfUnit, ...names])];
  }

  /**
   * فراخوانی systemctl.
   *
   * جدا شده تا در تست بدون systemctlِ واقعی جایگزین (spy) شود؛ کد اصلی هرگز
   * پوسته صدا نمی‌زند و آرگومان‌ها را مستقیم می‌دهد.
   */
  protected runSystemctl(
    args: string[],
    timeout: number,
  ): Promise<{ stdout: string }> {
    return run('systemctl', args, { timeout });
  }

  /** آیا روی این سکو systemctl هست؟ (dev روی ویندوز نه.) */
  get supported(): boolean {
    return process.platform === 'linux';
  }

  isManaged(name: string): boolean {
    return this.managed.includes(name);
  }

  /** وضعیت همه‌ی سرویس‌های مجاز. */
  async list(): Promise<ServiceStatus[]> {
    if (!this.supported) return [];
    return Promise.all(this.managed.map((name) => this.status(name)));
  }

  private async status(name: string): Promise<ServiceStatus> {
    const base: ServiceStatus = {
      name,
      description: name,
      activeState: 'unknown',
      subState: 'unknown',
      isSelf: name === this.selfUnit,
      since: null,
      memoryBytes: null,
    };

    try {
      const { stdout } = await this.runSystemctl(
        [
          'show',
          `${name}.service`,
          '--property=Description,ActiveState,SubState,ActiveEnterTimestamp,MemoryCurrent',
        ],
        5000,
      );
      const props = this.parseShow(stdout);
      return {
        ...base,
        description: props.Description || name,
        activeState: props.ActiveState || 'unknown',
        subState: props.SubState || 'unknown',
        since: this.parseTimestamp(props.ActiveEnterTimestamp),
        memoryBytes: this.parseMemory(props.MemoryCurrent),
      };
    } catch (error) {
      // نبودِ واحد یا خطای systemctl نباید کل فهرست را بشکند.
      this.logger.warn(
        `خواندن وضعیت «${name}» ناموفق بود: ${(error as Error).message}`,
      );
      return base;
    }
  }

  /** اجرای start/stop/restart روی یک سرویسِ مجاز. */
  async control(name: string, action: ServiceAction): Promise<ControlResult> {
    if (!this.supported) {
      throw new BadRequestException(
        'کنترل سرویس فقط روی سرور لینوکسی در دسترس است.',
      );
    }
    if (!SERVICE_ACTIONS.includes(action)) {
      throw new BadRequestException('کارِ درخواستی مجاز نیست.');
    }
    /*
     * سنگرِ اصلی: نام باید دقیقا یکی از allowlist باشد.
     *
     * چون این تنها جایی است که نام به systemctl می‌رسد، تطبیق دقیق با
     * allowlist یعنی حتی اگر گارد هم روزی دور زده شود، کاربر نمی‌تواند
     * سرویس دلخواهِ سیستم را دستکاری کند.
     */
    if (!this.isManaged(name)) {
      throw new ForbiddenException('این سرویس در فهرست مجاز نیست.');
    }

    this.logger.log(`اجرای ${action} روی ${name}.service`);
    try {
      await this.runSystemctl([action, `${name}.service`], 15000);
      return { ok: true, message: `«${name}» ${this.actionLabel(action)} شد.` };
    } catch (error) {
      /*
       * ری‌استارتِ خودِ این سرویس، فرایند را وسط پاسخ می‌کُشد؛ ممکن است این
       * خطا در واقع همان «موفق ولی اتصال قطع شد» باشد. پیام را خنثی نگه
       * می‌داریم تا پنل بعدش با pollکردنِ وضعیت، نتیجه‌ی واقعی را نشان دهد.
       */
      const message = (error as Error).message;
      this.logger.warn(`${action} روی ${name} خطا داد: ${message}`);
      return { ok: false, message };
    }
  }

  private actionLabel(action: ServiceAction): string {
    return action === 'start'
      ? 'روشن'
      : action === 'stop'
        ? 'خاموش'
        : 'ری‌استارت';
  }

  private parseShow(stdout: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const line of stdout.split('\n')) {
      const eq = line.indexOf('=');
      if (eq > 0) out[line.slice(0, eq)] = line.slice(eq + 1).trim();
    }
    return out;
  }

  private parseTimestamp(value?: string): string | null {
    if (!value || value === '0' || value === 'n/a') return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  private parseMemory(value?: string): number | null {
    // MemoryCurrent وقتی در دسترس نباشد مقدارِ بسیار بزرگِ [not set] می‌دهد.
    if (!value || value === '[not set]') return null;
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 && n < 1e15 ? n : null;
  }
}
