import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import {
  JobStatus,
  QueuedJobEntity,
} from '../database/entities/queued-job.entity';

/** پردازشگر یک نوع کار. */
export type JobHandler = (payload: Record<string, unknown>) => Promise<void>;

const POLL_INTERVAL_MS = Number(process.env.QUEUE_POLL_INTERVAL_MS ?? 2000);
const BATCH_SIZE = Number(process.env.QUEUE_BATCH_SIZE ?? 10);
const RETRY_BASE_MS = Number(process.env.QUEUE_RETRY_BASE_MS ?? 5000);

/**
 * صف پایدار روی دیتابیس.
 *
 * جایگزین Redis/Bull است و همان الزام «بدون سرویس بیرونی» را نگه
 * می‌دارد، ولی برخلاف صف درون‌حافظه، کارها با ری‌استارت سرور از بین
 * نمی‌روند.
 *
 * محدودیت آگاهانه: برداشتن کار با یک UPDATE شرطی انجام می‌شود که برای
 * یک نمونه‌ی سرور کافی است؛ برای اجرای چندنمونه‌ای باید قفل ردیف
 * (SELECT … FOR UPDATE SKIP LOCKED) اضافه شود.
 */
@Injectable()
export class DurableQueueService implements OnModuleInit {
  private readonly logger = new Logger(DurableQueueService.name);
  private readonly handlers = new Map<string, JobHandler>();
  private timer: NodeJS.Timeout | null = null;
  private draining = false;

  constructor(
    @InjectRepository(QueuedJobEntity)
    private readonly jobRepo: Repository<QueuedJobEntity>,
  ) {}

  onModuleInit() {
    // کارهایی که هنگام خاموشی وسط اجرا بودند دوباره در صف می‌نشینند.
    void this.recoverStuckJobs();
    this.start();
  }

  register(kind: string, handler: JobHandler) {
    this.handlers.set(kind, handler);
  }

  /** افزودن کار به صف؛ بلافاصله در دیتابیس ثبت می‌شود. */
  async enqueue(
    kind: string,
    payload: Record<string, unknown>,
    options: { maxAttempts?: number; delayMs?: number } = {},
  ) {
    return this.jobRepo.save(
      this.jobRepo.create({
        kind,
        payload,
        status: JobStatus.PENDING,
        attempts: 0,
        maxAttempts: options.maxAttempts ?? 3,
        runAfter: new Date(Date.now() + (options.delayMs ?? 0)),
      }),
    );
  }

  async stats() {
    const [pending, running, failed] = await Promise.all([
      this.jobRepo.count({ where: { status: JobStatus.PENDING } }),
      this.jobRepo.count({ where: { status: JobStatus.RUNNING } }),
      this.jobRepo.count({ where: { status: JobStatus.FAILED } }),
    ]);
    return { pending, running, failed };
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => void this.drain(), POLL_INTERVAL_MS);
    // اجازه می‌دهیم فرایند بدون انتظار برای این تایمر خاتمه یابد.
    this.timer.unref?.();
  }

  stop() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  /** یک دور پردازش؛ در تست‌ها مستقیم صدا زده می‌شود. */
  async drain() {
    if (this.draining) return { processed: 0 };
    this.draining = true;

    try {
      const jobs = await this.jobRepo.find({
        where: {
          status: JobStatus.PENDING,
          runAfter: LessThanOrEqual(new Date()),
        },
        order: { runAfter: 'ASC' },
        take: BATCH_SIZE,
      });

      let processed = 0;
      for (const job of jobs) {
        if (await this.runJob(job)) processed += 1;
      }
      return { processed };
    } finally {
      this.draining = false;
    }
  }

  private async runJob(job: QueuedJobEntity): Promise<boolean> {
    const handler = this.handlers.get(job.kind);
    if (!handler) {
      this.logger.warn(`پردازشگری برای کار «${job.kind}» ثبت نشده است`);
      return false;
    }

    // برداشتن کار به‌صورت شرطی تا دو دور همزمان یک کار را برندارند.
    const claimed = await this.jobRepo.update(
      { id: job.id, status: JobStatus.PENDING },
      { status: JobStatus.RUNNING, attempts: job.attempts + 1 },
    );
    if (!claimed.affected) return false;

    try {
      await handler(job.payload);
      await this.jobRepo.update(job.id, {
        status: JobStatus.DONE,
        lastError: null,
      });
      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'خطای نامشخص در اجرای کار';
      const attempts = job.attempts + 1;

      if (attempts >= job.maxAttempts) {
        await this.jobRepo.update(job.id, {
          status: JobStatus.FAILED,
          lastError: message,
        });
        this.logger.error(`کار «${job.kind}» پس از ${attempts} تلاش شکست خورد`);
      } else {
        await this.jobRepo.update(job.id, {
          status: JobStatus.PENDING,
          lastError: message,
          // تاخیر نمایی تا سرویس مقصد فرصت بازیابی داشته باشد.
          runAfter: new Date(Date.now() + RETRY_BASE_MS * 2 ** job.attempts),
        });
      }
      return false;
    }
  }

  /**
   * کارهایی که وضعیت‌شان «در حال اجرا» مانده یعنی سرور وسط کار خاموش
   * شده است؛ دوباره در صف می‌نشینند.
   */
  private async recoverStuckJobs() {
    const recovered = await this.jobRepo.update(
      { status: JobStatus.RUNNING },
      { status: JobStatus.PENDING },
    );
    if (recovered.affected) {
      this.logger.log(
        `${recovered.affected} کار نیمه‌تمام پس از راه‌اندازی دوباره به صف بازگشت`,
      );
    }
  }
}
