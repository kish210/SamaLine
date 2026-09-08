import { existsSync, mkdirSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { IS_SQLITE } from './column-types';
import { ALL_ENTITIES } from './entities';
import { Baseline1788846783305 } from './migrations/1788846783305-Baseline';

/**
 * مهاجرت‌ها به‌صورت کلاس وارد می‌شوند نه با الگوی مسیر.
 *
 * الگوی مسیر پس از build باید به `dist` اشاره کند و در توسعه به `src`؛
 * همین دوگانگی جایی از قلم می‌افتد و مهاجرت بی‌صدا اجرا نمی‌شود. وارد کردن
 * مستقیم، این خطا را غیرممکن می‌کند.
 */
const MIGRATIONS = [Baseline1788846783305];

/** مسیر فایل دیتابیس SQLite؛ نسبی‌ها از ریشه‌ی backend حساب می‌شوند. */
export function sqliteDatabasePath(): string {
  const raw = process.env.SQLITE_PATH ?? 'data/samaline.sqlite';
  const abs = isAbsolute(raw) ? raw : resolve(process.cwd(), raw);
  const dir = dirname(abs);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return abs;
}

export function buildDataSourceOptions(
  overrides: Partial<DataSourceOptions> = {},
): DataSourceOptions {
  const base: DataSourceOptions = IS_SQLITE
    ? {
        type: 'better-sqlite3',
        database: sqliteDatabasePath(),
        entities: ALL_ENTITIES,
        migrations: MIGRATIONS,
        /*
         * اسکیما با مهاجرت ساخته می‌شود، نه synchronize.
         *
         * synchronize روی SQLite برای تغییر ستون، جدول را بازمی‌سازد (کپی
         * به جدول موقت، حذف، تغییر نام) و این کار بی‌صدا انجام می‌شد؛ در
         * محیط واقعی یعنی هر تغییر ساختار یک ریسک از دست رفتن داده.
         * مهاجرت‌ها صریح‌اند، یک‌بار اجرا می‌شوند و ثبت می‌شوند.
         */
        synchronize: false,
        migrationsRun: false,
      }
    : {
        type: 'postgres',
        url: process.env.DATABASE_URL,
        entities: ALL_ENTITIES,
        migrations: MIGRATIONS,
        synchronize: false,
        migrationsRun: false,
      };

  return { ...base, ...overrides } as DataSourceOptions;
}

/** DataSource مستقل برای اسکریپت‌های CLI (seed، migration، ابزارهای نگهداری). */
export const appDataSource = new DataSource(buildDataSourceOptions());
