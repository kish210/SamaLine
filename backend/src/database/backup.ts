import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
} from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { Logger } from '@nestjs/common';

/** چند پشتیبان خودکار نگه داشته شود. */
const KEEP = 10;

const logger = new Logger('DatabaseBackup');

/**
 * کپی گرفتن از فایل SQLite پیش از تغییر اسکیما.
 *
 * مهاجرت روی SQLite گاهی جدول را بازمی‌سازد (کپی به جدول موقت، حذف، تغییر
 * نام). اگر وسط این کار چیزی اشتباه برود، بدون کپی هیچ راه برگشتی نیست —
 * و پایگاه‌داده‌ی این پروژه یک فایل است، پس گرفتن کپی یعنی یک دستور.
 *
 * شکست پشتیبان‌گیری بالا آمدن برنامه را متوقف نمی‌کند: نبودن فضای دیسک
 * برای کپی، دلیل خوبی برای از کار انداختن کل سامانه نیست. ولی هشدارش در
 * لاگ می‌ماند.
 */
export function backupSqlite(databasePath: string): string | null {
  try {
    if (!existsSync(databasePath)) return null;

    const dir = join(dirname(databasePath), 'backups');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const stamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .slice(0, 19);
    const target = join(dir, `${basename(databasePath)}.${stamp}.bak`);

    copyFileSync(databasePath, target);
    prune(dir);

    logger.log(`پشتیبان پیش از مهاجرت: ${target}`);
    return target;
  } catch (error) {
    logger.warn(`پشتیبان‌گیری انجام نشد: ${(error as Error).message}`);
    return null;
  }
}

/** فقط تازه‌ترین‌ها می‌مانند؛ وگرنه پوشه بی‌نهایت رشد می‌کند. */
function prune(dir: string) {
  const files = readdirSync(dir)
    .filter((name) => name.endsWith('.bak'))
    .map((name) => ({ name, time: statSync(join(dir, name)).mtimeMs }))
    .sort((a, b) => b.time - a.time);

  for (const file of files.slice(KEEP)) {
    try {
      unlinkSync(join(dir, file.name));
    } catch {
      // پاک نشدن یک فایل قدیمی مهم نیست.
    }
  }
}
