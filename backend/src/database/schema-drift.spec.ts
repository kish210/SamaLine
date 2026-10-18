import { DataSource } from 'typeorm';
import { SQLITE_MIGRATIONS } from './data-source';
import { ALL_ENTITIES } from './entities';

/**
 * اسکیمای ساخته‌شده با مهاجرت‌ها باید دقیقا همان باشد که موجودیت‌ها
 * می‌خواهند.
 *
 * تست‌های دیگر با synchronize اجرا می‌شوند، پس اگر ستونی به موجودیت اضافه
 * شود و مهاجرتش فراموش شود، همه سبزند ولی سرور واقعی با «no such column»
 * بالا نمی‌آید. این تست همان را می‌گیرد.
 */
describe('هم‌خوانی مهاجرت‌ها با موجودیت‌ها (SQLite)', () => {
  it('پس از اجرای همه‌ی مهاجرت‌ها، تغییر اسکیمای باقی‌مانده‌ای نیست', async () => {
    const ds = new DataSource({
      type: 'better-sqlite3',
      database: ':memory:',
      entities: ALL_ENTITIES,
      migrations: SQLITE_MIGRATIONS,
      synchronize: false,
    });
    await ds.initialize();
    try {
      await ds.runMigrations();
      const pending = await ds.driver.createSchemaBuilder().log();
      expect(pending.upQueries.map((q) => q.query)).toEqual([]);
    } finally {
      await ds.destroy();
    }
  });
});
