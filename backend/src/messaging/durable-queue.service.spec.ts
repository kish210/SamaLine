jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
  InjectDataSource: () => () => undefined,
  getRepositoryToken: (entity: unknown) => entity,
  TypeOrmModule: { forFeature: () => ({}), forRoot: () => ({}) },
}));

import type { DataSource } from 'typeorm';
import {
  JobStatus,
  QueuedJobEntity,
} from '../database/entities/queued-job.entity';
import { createTestDataSource } from '../testing/test-database';
import { DurableQueueService } from './durable-queue.service';

describe('DurableQueueService — صف پایدار', () => {
  let ds: DataSource;
  let queue: DurableQueueService;

  beforeEach(async () => {
    ds = await createTestDataSource();
    queue = new DurableQueueService(ds.getRepository(QueuedJobEntity));
  });

  afterEach(async () => {
    queue.stop();
    await ds.destroy();
  });

  const jobs = () => ds.getRepository(QueuedJobEntity).find();

  it('کار را در دیتابیس ثبت می‌کند نه در حافظه', async () => {
    await queue.enqueue('test.job', { value: 1 });

    const stored = await jobs();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      kind: 'test.job',
      status: JobStatus.PENDING,
      attempts: 0,
    });
  });

  it('کار موفق را اجرا و تمام‌شده علامت می‌زند', async () => {
    const handler = jest.fn().mockResolvedValue(undefined);
    queue.register('test.job', handler);
    await queue.enqueue('test.job', { value: 42 });

    const result = await queue.drain();

    expect(result.processed).toBe(1);
    expect(handler).toHaveBeenCalledWith({ value: 42 });
    expect((await jobs())[0].status).toBe(JobStatus.DONE);
  });

  it('کار ناموفق را با تاخیر دوباره در صف می‌گذارد', async () => {
    queue.register(
      'test.job',
      jest.fn().mockRejectedValue(new Error('سرویس در دسترس نیست')),
    );
    await queue.enqueue('test.job', {}, { maxAttempts: 3 });

    await queue.drain();

    const [job] = await jobs();
    expect(job.status).toBe(JobStatus.PENDING);
    expect(job.attempts).toBe(1);
    expect(job.lastError).toBe('سرویس در دسترس نیست');
    // تاخیر تلاش مجدد یعنی همین حالا دوباره اجرا نمی‌شود.
    expect(job.runAfter.getTime()).toBeGreaterThan(Date.now());
  });

  it('پس از پایان تلاش‌ها کار را شکست‌خورده علامت می‌زند', async () => {
    queue.register('test.job', jest.fn().mockRejectedValue(new Error('خراب')));
    await queue.enqueue('test.job', {}, { maxAttempts: 1 });

    await queue.drain();

    expect((await jobs())[0].status).toBe(JobStatus.FAILED);
  });

  it('کار زمان‌بندی‌شده برای آینده را زود اجرا نمی‌کند', async () => {
    const handler = jest.fn().mockResolvedValue(undefined);
    queue.register('test.job', handler);
    await queue.enqueue('test.job', {}, { delayMs: 60000 });

    await queue.drain();

    expect(handler).not.toHaveBeenCalled();
    expect((await jobs())[0].status).toBe(JobStatus.PENDING);
  });

  it('کار بدون پردازشگر را دست‌نخورده می‌گذارد', async () => {
    await queue.enqueue('unknown.job', {});

    await queue.drain();

    expect((await jobs())[0].status).toBe(JobStatus.PENDING);
  });

  it('کار نیمه‌تمام پس از راه‌اندازی دوباره به صف بازمی‌گردد', async () => {
    // شبیه‌سازی خاموشی سرور وسط اجرای کار
    await ds.getRepository(QueuedJobEntity).save({
      kind: 'test.job',
      payload: {},
      status: JobStatus.RUNNING,
      attempts: 1,
      maxAttempts: 3,
      runAfter: new Date(),
    });

    const handler = jest.fn().mockResolvedValue(undefined);
    queue.register('test.job', handler);
    queue.onModuleInit();
    // بازیابی ناهمگام است؛ به آن فرصت اجرا می‌دهیم.
    await new Promise((resolve) => setTimeout(resolve, 50));
    await queue.drain();

    expect(handler).toHaveBeenCalled();
    expect((await jobs())[0].status).toBe(JobStatus.DONE);
  });

  it('چند کار را در یک دور پردازش می‌کند', async () => {
    const handler = jest.fn().mockResolvedValue(undefined);
    queue.register('test.job', handler);
    for (let i = 0; i < 5; i += 1) {
      await queue.enqueue('test.job', { i });
    }

    const result = await queue.drain();

    expect(result.processed).toBe(5);
    expect(handler).toHaveBeenCalledTimes(5);
  });

  it('آمار صف را گزارش می‌دهد', async () => {
    await queue.enqueue('a', {});
    await queue.enqueue('b', {});

    await expect(queue.stats()).resolves.toMatchObject({
      pending: 2,
      running: 0,
      failed: 0,
    });
  });
});
