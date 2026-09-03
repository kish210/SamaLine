import { InProcessQueue } from './in-process-queue';

describe('InProcessQueue', () => {
  it('نتیجه‌ی کار موفق را برمی‌گرداند', async () => {
    const queue = new InProcessQueue();
    await expect(queue.add(() => Promise.resolve('ok'))).resolves.toBe('ok');
  });

  it('هم‌روندی را از سقف تعیین‌شده بیشتر نمی‌کند', async () => {
    const queue = new InProcessQueue({ concurrency: 2 });
    let running = 0;
    let peak = 0;

    const task = () =>
      new Promise<void>((resolve) => {
        running += 1;
        peak = Math.max(peak, running);
        setTimeout(() => {
          running -= 1;
          resolve();
        }, 10);
      });

    await queue.addAll(Array.from({ length: 8 }, () => task));
    expect(peak).toBeLessThanOrEqual(2);
  });

  it('کار ناموفق را دوباره تلاش می‌کند و در تلاش بعدی موفق می‌شود', async () => {
    const queue = new InProcessQueue({ maxAttempts: 3, retryDelayMs: 1 });
    let attempts = 0;

    const result = await queue.add(() => {
      attempts += 1;
      return attempts < 3
        ? Promise.reject(new Error('خطای موقت'))
        : Promise.resolve('موفق');
    });

    expect(result).toBe('موفق');
    expect(attempts).toBe(3);
  });

  it('پس از پایان تلاش‌ها خطا را برمی‌گرداند', async () => {
    const queue = new InProcessQueue({ maxAttempts: 2, retryDelayMs: 1 });
    let attempts = 0;

    await expect(
      queue.add(() => {
        attempts += 1;
        return Promise.reject(new Error('همیشه خراب'));
      }),
    ).rejects.toThrow('همیشه خراب');
    expect(attempts).toBe(2);
  });

  it('خطای یک کار مانع اجرای بقیه نمی‌شود', async () => {
    const queue = new InProcessQueue({ maxAttempts: 1 });
    const results = await Promise.allSettled([
      queue.add(() => Promise.reject(new Error('خراب'))),
      queue.add(() => Promise.resolve('سالم')),
    ]);

    expect(results[0].status).toBe('rejected');
    expect(results[1]).toEqual({ status: 'fulfilled', value: 'سالم' });
  });

  it('صف خالی وضعیت صفر گزارش می‌دهد', () => {
    expect(new InProcessQueue().stats).toEqual({ pending: 0, active: 0 });
  });
});
