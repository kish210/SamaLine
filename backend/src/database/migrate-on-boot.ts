import { Logger } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { IS_SQLITE } from './column-types';
import { backupSqlite } from './backup';

const logger = new Logger('Migrations');

/** جدولی که وجودش یعنی این پایگاه‌داده از قبل ساخته شده است. */
const SENTINEL_TABLE = 'organizations';

/**
 * اجرای مهاجرت‌ها هنگام بالا آمدن.
 *
 * سه حالت را از هم جدا می‌کند:
 *
 * ۱. پایگاه‌داده‌ی خالی → همه‌ی مهاجرت‌ها اجرا می‌شوند.
 * ۲. پایگاه‌داده‌ی موجودی که هنوز جدول مهاجرت ندارد (نصب‌های قبل از این
 *    تغییر، که با synchronize ساخته شده‌اند) → مهاجرت پایه «اعمال‌شده» ثبت
 *    می‌شود بدون اجرا. اجرای واقعی‌اش `CREATE TABLE` روی جدول‌های موجود
 *    است و شکست می‌خورد.
 * ۳. پایگاه‌داده‌ی به‌روز → فقط مهاجرت‌های تازه اجرا می‌شوند.
 *
 * پیش از هر اجرای واقعی روی SQLite، از فایل کپی گرفته می‌شود.
 */
export async function runMigrations(dataSource: DataSource): Promise<void> {
  const isExisting = await hasTable(dataSource, SENTINEL_TABLE);
  const hasMigrationsTable = await hasTable(dataSource, 'migrations');

  if (isExisting && !hasMigrationsTable) {
    await baselineExistingDatabase(dataSource);
    return;
  }

  const pending = await dataSource.showMigrations();
  if (!pending) {
    logger.log('اسکیما به‌روز است.');
    return;
  }

  /*
   * مسیر فایل از خودِ DataSource خوانده می‌شود نه از متغیر محیطی.
   *
   * خواندن دوباره‌ی محیط یعنی اگر جایی DataSource با مسیر دیگری ساخته شده
   * باشد، از فایل اشتباهی پشتیبان گرفته می‌شود — و آن پشتیبان دقیقا وقتی
   * لازم می‌شود که فهمیدنش دیر است.
   */
  const file = dataSource.options.database;
  if (IS_SQLITE && typeof file === 'string') {
    backupSqlite(file);
  } else if (!IS_SQLITE) {
    // Postgres فایل تکی نیست؛ پشتیبانش کار pg_dump است نه کپی فایل.
    logger.warn(
      'پیش از مهاجرت روی Postgres، خودتان با pg_dump پشتیبان بگیرید.',
    );
  }

  const applied = await dataSource.runMigrations({ transaction: 'all' });
  logger.log(
    applied.length
      ? `${applied.length} مهاجرت اجرا شد: ${applied.map((m) => m.name).join('، ')}`
      : 'مهاجرت تازه‌ای نبود.',
  );
}

/**
 * ثبت مهاجرت پایه برای پایگاه‌داده‌ای که از قبل اسکیما دارد.
 *
 * این تنها جای امنی است که می‌شود مهاجرت را بدون اجرا «اعمال‌شده» شمرد:
 * جدول‌ها با synchronize دقیقا از روی همین موجودیت‌ها ساخته شده‌اند، پس
 * نتیجه یکی است.
 */
async function baselineExistingDatabase(dataSource: DataSource): Promise<void> {
  const [first] = dataSource.migrations;
  if (!first) return;

  const name = first.constructor.name;
  /*
   * TypeORM مهر زمانی را از انتهای نام کلاس می‌خواند و همان را در جدول
   * `migrations` می‌نویسد. اگر عدد ثبت‌شده با آنچه بعدا محاسبه می‌کند فرق
   * کند، مهاجرت را «اجرانشده» می‌بیند و دوباره اجرایش می‌کند.
   */
  const timestamp = Number(/(\d+)$/.exec(name)?.[1]);
  if (!Number.isFinite(timestamp)) {
    logger.warn(`مهر زمانی مهاجرت «${name}» خوانده نشد؛ ثبت پایه انجام نشد.`);
    return;
  }

  const runner = dataSource.createQueryRunner();
  try {
    await runner.createTable(
      new (await import('typeorm')).Table({
        name: 'migrations',
        columns: [
          {
            name: 'id',
            type: IS_SQLITE ? 'integer' : 'SERIAL',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'timestamp', type: IS_SQLITE ? 'bigint' : 'bigint' },
          { name: 'name', type: 'varchar' },
        ],
      }),
      true,
    );

    await runner.query(
      `INSERT INTO "migrations" ("timestamp", "name") VALUES (${timestamp}, '${name}')`,
    );

    logger.log(
      `پایگاه‌داده‌ی موجود شناسایی شد؛ مهاجرت پایه «${name}» بدون اجرا ثبت شد.`,
    );
  } finally {
    await runner.release();
  }
}

async function hasTable(dataSource: DataSource, table: string) {
  const runner = dataSource.createQueryRunner();
  try {
    return await runner.hasTable(table);
  } finally {
    await runner.release();
  }
}
