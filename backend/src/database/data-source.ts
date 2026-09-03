import { existsSync, mkdirSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { IS_SQLITE } from './column-types';
import { ALL_ENTITIES } from './entities';

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
        // SQLite حالت خوداتکای پروژه است: اسکیمای آن از روی موجودیت‌ها ساخته
        // می‌شود تا نصب بدون هیچ ابزار بیرونی ممکن باشد.
        synchronize: true,
      }
    : {
        type: 'postgres',
        url: process.env.DATABASE_URL,
        entities: ALL_ENTITIES,
        synchronize: false,
      };

  return { ...base, ...overrides } as DataSourceOptions;
}

/** DataSource مستقل برای اسکریپت‌های CLI (seed، migration، ابزارهای نگهداری). */
export const appDataSource = new DataSource(buildDataSourceOptions());
