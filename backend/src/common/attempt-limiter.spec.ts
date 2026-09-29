import { AttemptLimiter } from './attempt-limiter';

describe('AttemptLimiter', () => {
  it('پس از رسیدن به سقف قفل می‌کند و پس از مهلت باز می‌کند', () => {
    const limiter = new AttemptLimiter(3, 60_000, 10_000);
    const t0 = 1_000_000;
    limiter.fail('a', t0);
    limiter.fail('a', t0 + 1);
    expect(limiter.isLocked('a', t0 + 2)).toBe(false);
    limiter.fail('a', t0 + 2);
    expect(limiter.isLocked('a', t0 + 3)).toBe(true);
    expect(limiter.isLocked('a', t0 + 10_003)).toBe(false);
  });

  it('شکست‌های بیرون از بازه شمرده نمی‌شوند', () => {
    const limiter = new AttemptLimiter(3, 1_000, 10_000);
    limiter.fail('a', 0);
    limiter.fail('a', 10);
    limiter.fail('a', 5_000);
    expect(limiter.isLocked('a', 5_001)).toBe(false);
  });

  it('موفقیت شمارش را پاک می‌کند و کلیدها مستقل‌اند', () => {
    const limiter = new AttemptLimiter(2, 60_000, 10_000);
    limiter.fail('a', 0);
    limiter.succeed('a');
    limiter.fail('a', 1);
    expect(limiter.isLocked('a', 2)).toBe(false);
    limiter.fail('b', 1);
    limiter.fail('b', 2);
    expect(limiter.isLocked('b', 3)).toBe(true);
    expect(limiter.isLocked('a', 3)).toBe(false);
  });
});
