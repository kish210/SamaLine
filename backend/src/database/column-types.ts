/**
 * لایه‌ی سازگاری نوع ستون‌ها بین درایورهای دیتابیس.
 *
 * پیش‌فرض پروژه SQLite است تا سامانه بدون نصب هیچ سرویس بیرونی
 * (Postgres/Docker) قابل اجرا باشد. با تنظیم DB_DRIVER=postgres
 * همان نوع‌های بومی Postgres استفاده می‌شود.
 */
export type DbDriver = 'sqlite' | 'postgres';

export const DB_DRIVER: DbDriver =
  (process.env.DB_DRIVER ?? 'sqlite').toLowerCase() === 'postgres'
    ? 'postgres'
    : 'sqlite';

export const IS_SQLITE = DB_DRIVER === 'sqlite';

export const JSON_COLUMN = IS_SQLITE ? 'simple-json' : 'jsonb';
export const TIMESTAMP_COLUMN = IS_SQLITE ? 'datetime' : 'timestamptz';
export const ENUM_COLUMN = IS_SQLITE ? 'simple-enum' : 'enum';
export const UUID_COLUMN = IS_SQLITE ? 'varchar' : 'uuid';
export const NOW_SQL = IS_SQLITE ? 'CURRENT_TIMESTAMP' : 'NOW()';

/** SQLite اپراتور ILIKE ندارد؛ LIKE در آن به‌صورت پیش‌فرض غیرحساس به حروف است. */
export const LIKE_OPERATOR = IS_SQLITE ? 'LIKE' : 'ILIKE';
