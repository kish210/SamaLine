/**
 * صف کار درون‌فرایندی با هم‌روندی محدود و تلاش مجدد نمایی.
 *
 * جایگزین Redis/Bull است تا ارسال انبوه بدون هیچ سرویس بیرونی کار کند
 * (الزام «نصب On-Premise بدون وابستگی» در بند ۱۲ سند).
 *
 * محدودیت آگاهانه: صف در حافظه است، پس با ری‌استارت فرایند کارهای
 * درصف از بین می‌روند. برای استقرارهای بزرگ باید به صف پایدار مهاجرت کرد.
 */
export interface QueueOptions {
  /** حداکثر کار هم‌زمان. */
  concurrency?: number;
  /** تعداد کل تلاش‌ها برای هر کار (شامل تلاش اول). */
  maxAttempts?: number;
  /** تاخیر پایه‌ی تلاش مجدد بر حسب میلی‌ثانیه. */
  retryDelayMs?: number;
}

interface QueueTask<T> {
  run: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
  attempt: number;
}

export class InProcessQueue {
  private readonly concurrency: number;
  private readonly maxAttempts: number;
  private readonly retryDelayMs: number;
  private readonly pending: Array<QueueTask<unknown>> = [];
  private active = 0;

  constructor(options: QueueOptions = {}) {
    this.concurrency = Math.max(1, options.concurrency ?? 5);
    this.maxAttempts = Math.max(1, options.maxAttempts ?? 3);
    this.retryDelayMs = Math.max(0, options.retryDelayMs ?? 500);
  }

  /** وضعیت لحظه‌ای صف — برای پایش و تست. */
  get stats() {
    return { pending: this.pending.length, active: this.active };
  }

  /** کار را به صف می‌افزاید و نتیجه‌ی نهایی آن را برمی‌گرداند. */
  add<T>(run: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.pending.push({
        run,
        resolve: resolve,
        reject,
        attempt: 0,
      });
      this.drain();
    });
  }

  /** همه‌ی کارها را به صف می‌دهد و منتظر پایان همه می‌ماند. */
  addAll<T>(runners: Array<() => Promise<T>>): Promise<T[]> {
    return Promise.all(runners.map((run) => this.add(run)));
  }

  private drain() {
    while (this.active < this.concurrency && this.pending.length) {
      const task = this.pending.shift();
      if (!task) break;
      this.active += 1;
      void this.execute(task);
    }
  }

  private async execute(task: QueueTask<unknown>) {
    try {
      task.resolve(await task.run());
    } catch (error) {
      const attempt = task.attempt + 1;
      if (attempt < this.maxAttempts) {
        // تاخیر نمایی: ۱x، ۲x، ۴x … تا سرویس‌دهنده فرصت بازیابی داشته باشد.
        const delay = this.retryDelayMs * 2 ** task.attempt;
        setTimeout(() => {
          this.pending.push({ ...task, attempt });
          this.drain();
        }, delay);
      } else {
        task.reject(error);
      }
    } finally {
      this.active -= 1;
      this.drain();
    }
  }
}
