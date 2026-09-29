import type { DataSource } from 'typeorm';
import { PlanCode, PlanPolicyEntity } from './entities/plan-policy.entity';
import { createTestDataSource } from '../testing/test-database';
import { DEFAULT_PLAN_LIMITS, ensureDefaultPlans } from './plan-defaults';

describe('پلن‌های پیش‌فرض', () => {
  let ds: DataSource;

  beforeEach(async () => {
    ds = await createTestDataSource();
  });

  afterEach(async () => {
    await ds.destroy();
  });

  it('روی نصب تازه همه‌ی پلن‌ها ساخته می‌شوند', async () => {
    const created = await ensureDefaultPlans(ds, { overwrite: false });
    expect(created.sort()).toEqual(Object.keys(DEFAULT_PLAN_LIMITS).sort());
    expect(await ds.getRepository(PlanPolicyEntity).count()).toBe(4);
  });

  it('هنگام بالا آمدن، سقفِ تغییریافته دست نمی‌خورد', async () => {
    await ensureDefaultPlans(ds, { overwrite: false });
    const repo = ds.getRepository(PlanPolicyEntity);
    const free = await repo.findOneByOrFail({ planCode: PlanCode.FREE });
    free.limits = { ...free.limits, activeForms: 3 };
    await repo.save(free);

    const changed = await ensureDefaultPlans(ds, { overwrite: false });

    expect(changed).toEqual([]);
    const after = await repo.findOneByOrFail({ planCode: PlanCode.FREE });
    expect(after.limits.activeForms).toBe(3);
  });

  it('دستور seed سقف‌ها را به پیش‌فرض برمی‌گرداند', async () => {
    await ensureDefaultPlans(ds, { overwrite: false });
    const repo = ds.getRepository(PlanPolicyEntity);
    const free = await repo.findOneByOrFail({ planCode: PlanCode.FREE });
    free.limits = { ...free.limits, activeForms: 3 };
    await repo.save(free);

    await ensureDefaultPlans(ds, { overwrite: true });

    const after = await repo.findOneByOrFail({ planCode: PlanCode.FREE });
    expect(after.limits.activeForms).toBe(1);
  });
});
