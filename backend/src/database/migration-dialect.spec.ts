import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { POSTGRES_MIGRATIONS, SQLITE_MIGRATIONS } from './data-source';

const DIR = join(__dirname, 'migrations');

function source(name: string) {
  return readFileSync(join(DIR, name), 'utf8');
}

/**
 * مهاجرت هر گویش باید فقط نحو همان گویش را داشته باشد.
 *
 * فهرست مهاجرت‌ها در `data-source.ts` بر اساس درایور انتخاب می‌شود؛ اگر
 * روزی یک مهاجرت در فهرست اشتباه بیفتد، تنها نشانه‌اش خطای نحوی SQL هنگام
 * بالا آمدن روی سرور است. این تست همان‌جا جلویش را می‌گیرد.
 */
describe('گویش مهاجرت‌ها', () => {
  const files = readdirSync(DIR).filter((f) => f.endsWith('.ts'));

  it('برای هر دو گویش مهاجرت وجود دارد', () => {
    expect(files.some((f) => f.includes('PgBaseline'))).toBe(true);
    expect(files.some((f) => f.includes('Baseline') && !f.includes('Pg'))).toBe(
      true,
    );
  });

  it('مهاجرت SQLite نحو Postgres ندارد', () => {
    for (const file of files.filter((f) => !f.includes('Pg'))) {
      const sql = source(file);
      // `jsonb`، `CREATE TYPE ... ENUM` و `SERIAL` روی SQLite بی‌معنی‌اند.
      expect(sql).not.toMatch(/\bjsonb\b/);
      expect(sql).not.toMatch(/CREATE TYPE .*ENUM/);
      expect(sql).not.toMatch(/\bSERIAL\b/);
    }
  });

  it('مهاجرت Postgres نحو SQLite ندارد', () => {
    const sql = source(files.find((f) => f.includes('PgBaseline'))!);
    // `datetime('now')` و `CHECK(... IN ...)` امضای SQLite هستند.
    expect(sql).not.toMatch(/datetime\('now'\)/);
    expect(sql).not.toMatch(/varchar PRIMARY KEY/);
  });

  it('نام کلاس مهاجرت با رقم شروع نمی‌شود', () => {
    /*
     * TypeORM نام کلاس را از نام فایل می‌سازد و نتیجه‌اش گاهی با رقم شروع
     * می‌شود — که TypeScript معتبر نیست و کل build را می‌شکند.
     */
    for (const file of files) {
      const match = /export class (\w+)/.exec(source(file));
      expect(match).not.toBeNull();
      expect(match![1]).toMatch(/^[A-Za-z_]/);
    }
  });

  it('هر مهاجرت مهر زمانی در انتهای نام کلاس دارد', () => {
    // ثبت پایه و تشخیص «اجرا شده یا نه» به همین عدد وابسته است.
    for (const file of files) {
      const match = /export class (\w+)/.exec(source(file));
      expect(match![1]).toMatch(/\d{10,}$/);
    }
  });

  it('هر فایل مهاجرت در فهرست گویش خودش ثبت شده است', () => {
    /*
     * فایل مهاجرتی که نوشته شود ولی در data-source ثبت نشود، بی‌صدا هرگز
     * اجرا نمی‌شود؛ روی Postgres که آزمون هم‌خوانی اسکیما ندارد، تنها نشانه‌اش
     * خطای «ستون وجود ندارد» روی سرور مشتری است.
     */
    const registered = (list: Array<{ name: string }>) =>
      new Set(list.map((migration) => migration.name));
    const sqlite = registered(SQLITE_MIGRATIONS);
    const postgres = registered(POSTGRES_MIGRATIONS);

    for (const file of files) {
      const name = /export class (\w+)/.exec(source(file))![1];
      const list = file.includes('Pg') ? postgres : sqlite;
      expect([file, list.has(name)]).toEqual([file, true]);
    }
  });
});
