import { ServiceControlService } from './service-control.service';

/**
 * زیرکلاسِ آزمون: به‌جای systemctlِ واقعی، فراخوانی‌ها را ثبت می‌کند و خروجی
 * ساختگی می‌دهد. این‌طوری منطقِ allowlist و اعتبارسنجی بدون سرور لینوکسی
 * آزموده می‌شود.
 */
class TestService extends ServiceControlService {
  calls: string[][] = [];
  fail = false;
  showOutput =
    'Description=SamaLine\nActiveState=active\nSubState=running\n' +
    'ActiveEnterTimestamp=Mon 2026-09-15 06:30:02 UTC\nMemoryCurrent=52428800\n';

  // supported را روشن نگه می‌داریم تا تست‌ها روی ویندوز هم اجرا شوند.
  get supported(): boolean {
    return true;
  }

  protected runSystemctl(args: string[]): Promise<{ stdout: string }> {
    this.calls.push(args);
    if (this.fail) return Promise.reject(new Error('unit not found'));
    return Promise.resolve({ stdout: this.showOutput });
  }
}

describe('ServiceControlService', () => {
  const OLD = { ...process.env };
  afterEach(() => {
    process.env = { ...OLD };
  });

  it('allowlist را از متغیر محیطی می‌خواند و خودِ سرویس همیشه هست', () => {
    process.env.MANAGED_SERVICES = 'nginx, kishbot';
    process.env.SELF_SERVICE_UNIT = 'samaline';
    const s = new TestService();
    expect(s.isManaged('samaline')).toBe(true);
    expect(s.isManaged('nginx')).toBe(true);
    expect(s.isManaged('kishbot')).toBe(true);
    expect(s.isManaged('postgresql')).toBe(false);
  });

  it('نامِ خارج از allowlist را رد می‌کند و systemctl صدا نمی‌زند', async () => {
    process.env.MANAGED_SERVICES = 'samaline';
    const s = new TestService();
    await expect(s.control('sshd', 'stop')).rejects.toThrow('فهرست مجاز');
    expect(s.calls).toHaveLength(0);
  });

  it('نام با کاراکتر غیرمجاز (تلاش برای تزریق) اصلا وارد allowlist نمی‌شود', () => {
    // «samaline; rm -rf /» نباید به‌عنوان یک نامِ معتبر پذیرفته شود.
    process.env.MANAGED_SERVICES = 'samaline; rm -rf /, ../../etc';
    const s = new TestService();
    expect(s.isManaged('samaline; rm -rf /')).toBe(false);
    expect(s.isManaged('../../etc')).toBe(false);
    // فقط خودِ سرویس می‌ماند.
    expect(s.isManaged('samaline')).toBe(true);
  });

  it('کارِ نامعتبر را رد می‌کند', async () => {
    const s = new TestService();
    // enable/mask و هرچیز غیر از سه‌تای مجاز.
    await expect(
      s.control('samaline', 'enable' as never),
    ).rejects.toThrow('مجاز نیست');
    expect(s.calls).toHaveLength(0);
  });

  it('restart را با آرگومان‌های درست به systemctl می‌دهد', async () => {
    const s = new TestService();
    const res = await s.control('samaline', 'restart');
    expect(res.ok).toBe(true);
    expect(s.calls[0]).toEqual(['restart', 'samaline.service']);
  });

  it('اسم واحد همیشه پسوند .service می‌گیرد و جدا از آرگومان‌هاست', async () => {
    // تضمین اینکه نام به‌صورت یک آرگومانِ مستقل می‌رود، نه چسبیده به فرمان.
    const s = new TestService();
    await s.control('samaline', 'stop');
    expect(s.calls[0]).toEqual(['stop', 'samaline.service']);
  });

  it('list وضعیت را درست تجزیه می‌کند', async () => {
    process.env.MANAGED_SERVICES = 'samaline';
    const s = new TestService();
    const [status] = await s.list();
    expect(status.name).toBe('samaline');
    expect(status.description).toBe('SamaLine');
    expect(status.activeState).toBe('active');
    expect(status.subState).toBe('running');
    expect(status.isSelf).toBe(true);
    expect(status.memoryBytes).toBe(52428800);
    expect(status.since).not.toBeNull();
  });

  it('خطای systemctl کل فهرست را نمی‌شکند، فقط وضعیت را unknown می‌کند', async () => {
    const s = new TestService();
    s.fail = true;
    const [status] = await s.list();
    expect(status.activeState).toBe('unknown');
    expect(status.name).toBe('samaline');
  });

  it('MemoryCurrent برابر [not set] به null تبدیل می‌شود', async () => {
    const s = new TestService();
    s.showOutput =
      'Description=X\nActiveState=inactive\nSubState=dead\n' +
      'ActiveEnterTimestamp=\nMemoryCurrent=[not set]\n';
    const [status] = await s.list();
    expect(status.memoryBytes).toBeNull();
    expect(status.since).toBeNull();
  });

  it('control روی سکوی غیرلینوکسی خطای روشن می‌دهد', async () => {
    const s = new ServiceControlService(); // supportedِ واقعی
    if (!s.supported) {
      await expect(s.control('samaline', 'restart')).rejects.toThrow(
        'لینوکسی',
      );
    }
  });
});
