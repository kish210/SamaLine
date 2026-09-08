jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
  InjectDataSource: () => () => undefined,
  getRepositoryToken: (entity: unknown) => entity,
  TypeOrmModule: { forFeature: () => ({}), forRoot: () => ({}) },
}));

import { mkdtempSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { ALL_ENTITIES } from './entities';
import { Baseline1788846783305 } from './migrations/1788846783305-Baseline';
import { runMigrations } from './migrate-on-boot';
import { OrganizationEntity } from './entities/organization.entity';

/** پایگاه‌داده‌ی فایلی موقت؛ مهاجرت روی حافظه معنای «نصب موجود» ندارد. */
function tempDbPath(): string {
  return join(mkdtempSync(join(tmpdir(), 'samaline-mig-')), 'test.sqlite');
}

function makeDataSource(path: string, options: { migrations: boolean }) {
  return new DataSource({
    type: 'better-sqlite3',
    database: path,
    entities: ALL_ENTITIES,
    migrations: options.migrations ? [Baseline1788846783305] : [],
    synchronize: !options.migrations,
    migrationsRun: false,
  });
}

describe('runMigrations', () => {
  jest.setTimeout(60_000);

  it('پایگاه‌داده‌ی خالی را با اجرای مهاجرت می‌سازد', async () => {
    const path = tempDbPath();
    const ds = await makeDataSource(path, { migrations: true }).initialize();

    await runMigrations(ds);

    const runner = ds.createQueryRunner();
    expect(await runner.hasTable('organizations')).toBe(true);
    expect(await runner.hasTable('telegram_recipients')).toBe(true);
    await runner.release();
    await ds.destroy();
  });

  it('نصب موجود را بدون اجرا ثبت می‌کند و داده را نگه می‌دارد', async () => {
    const path = tempDbPath();

    // نصب قدیمی: اسکیما با synchronize ساخته شده و داده دارد.
    const legacy = await makeDataSource(path, { migrations: false }).initialize();
    await legacy
      .getRepository(OrganizationEntity)
      .save({ name: 'سازمان قدیمی' });
    await legacy.destroy();

    const ds = await makeDataSource(path, { migrations: true }).initialize();
    await runMigrations(ds);

    /*
     * اجرای واقعی مهاجرت پایه روی این پایگاه‌داده `CREATE TABLE` تکراری
     * است و شکست می‌خورد؛ همین تست جلوی برگشتن آن رفتار را می‌گیرد.
     */
    const rows = await ds.getRepository(OrganizationEntity).find();
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('سازمان قدیمی');

    const applied = await ds.query('SELECT name FROM migrations');
    expect(applied).toHaveLength(1);
    expect(applied[0].name).toBe('Baseline1788846783305');

    await ds.destroy();
  });

  it('اجرای دوباره روی پایگاه‌داده‌ی به‌روز کاری نمی‌کند', async () => {
    const path = tempDbPath();
    const ds = await makeDataSource(path, { migrations: true }).initialize();

    await runMigrations(ds);
    await ds.getRepository(OrganizationEntity).save({ name: 'سازمان' });
    // بار دوم نباید چیزی را دوباره بسازد یا پاک کند.
    await runMigrations(ds);

    expect(await ds.getRepository(OrganizationEntity).find()).toHaveLength(1);
    expect(await ds.query('SELECT name FROM migrations')).toHaveLength(1);

    await ds.destroy();
  });

  it('پیش از اجرای مهاجرت روی نصب موجود، پشتیبان گرفته نمی‌شود چون اجرایی نیست', async () => {
    const path = tempDbPath();
    const legacy = await makeDataSource(path, { migrations: false }).initialize();
    await legacy.destroy();

    const ds = await makeDataSource(path, { migrations: true }).initialize();
    await runMigrations(ds);

    // ثبت پایه فایل را دست نمی‌زند، پس پوشه‌ی پشتیبان لازم نیست.
    const backups = join(path, '..', 'backups');
    expect(existsSync(backups) && readdirSync(backups).length > 0).toBe(false);

    await ds.destroy();
  });
});
