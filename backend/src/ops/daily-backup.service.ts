import {
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  unlinkSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { IS_SQLITE } from '../database/column-types';
import { sqliteDatabasePath } from '../database/data-source';

const DAY_MS = 24 * 60 * 60 * 1000;

/** نام فایل پشتیبان روزانه، مثل `samaline-2026-09-29.sqlite`. */
export function dailyBackupName(date: Date): string {
  return `samaline-${date.toISOString().slice(0, 10)}.sqlite`;
}

/** فایل‌هایی که باید پاک شوند تا فقط `keep` تای تازه بمانند. */
export function backupsToPrune(names: string[], keep: number): string[] {
  return names
    .filter((name) => /^samaline-\d{4}-\d{2}-\d{2}\.sqlite$/.test(name))
    .sort()
    .reverse()
    .slice(Math.max(0, keep));
}

/**
 * پشتیبان روزانه‌ی خودکار SQLite.
 *
 * پشتیبان پیش از مهاجرت فقط هنگام به‌روزرسانی گرفته می‌شد؛ خرابی دیسک یا
 * حذف اشتباه در روزهای عادی هیچ راه برگشتی نداشت. اینجا روزی یک بار با
 * API پشتیبان‌گیری آنلاین SQLite (که حین نوشتن هم نسخه‌ی سازگار می‌دهد، نه
 * کپی خام فایل) در `data/backups/daily` نسخه گرفته می‌شود.
 *
 * بدون cron و بدون سرویس جانبی، چون قرار است نصب ساده بماند.
 * با `DAILY_BACKUP_DISABLED=true` خاموش و با `DAILY_BACKUP_KEEP` تعداد
 * نسخه‌ها (پیش‌فرض ۱۴) تنظیم می‌شود. روی Postgres کاری نمی‌کند؛ آنجا
 * پشتیبان‌گیری کار خود پایگاه‌داده است (pg_dump).
 */
@Injectable()
export class DailyBackupService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(DailyBackupService.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(private readonly dataSource: DataSource) {}

  onApplicationBootstrap() {
    if (!IS_SQLITE || process.env.DAILY_BACKUP_DISABLED === 'true') return;
    if (process.env.NODE_ENV === 'test') return;

    // اولین نسخه کمی پس از بالا آمدن، تا راه‌اندازی را کند نکند.
    setTimeout(() => void this.runOnce(), 60_000).unref();
    // هر ساعت سر می‌زند ولی فقط اگر نسخه‌ی امروز نباشد می‌سازد؛ پس ری‌استارت
    // یا خواب سرور، روزی را از قلم نمی‌اندازد.
    this.timer = setInterval(() => void this.runOnce(), DAY_MS / 24);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** ساخت پشتیبان امروز اگر هنوز ساخته نشده. مسیر فایل یا null. */
  async runOnce(now = new Date()): Promise<string | null> {
    if (this.running || !this.dataSource.isInitialized) return null;
    this.running = true;
    try {
      const dir = join(dirname(sqliteDatabasePath()), 'backups', 'daily');
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

      const target = join(dir, dailyBackupName(now));
      if (existsSync(target)) return null;

      const db = (
        this.dataSource.driver as unknown as {
          databaseConnection: { backup: (path: string) => Promise<unknown> };
        }
      ).databaseConnection;
      await db.backup(target);

      const keep = Number(process.env.DAILY_BACKUP_KEEP ?? 14);
      for (const name of backupsToPrune(readdirSync(dir), keep)) {
        try {
          unlinkSync(join(dir, name));
        } catch {
          // پاک نشدن یک نسخه‌ی قدیمی نباید پشتیبان‌گیری را شکست بدهد.
        }
      }

      const sizeMb = (statSync(target).size / (1024 * 1024)).toFixed(1);
      this.logger.log(`پشتیبان روزانه ساخته شد: ${target} (${sizeMb} MB)`);
      return target;
    } catch (error) {
      this.logger.warn(`پشتیبان روزانه ساخته نشد: ${(error as Error).message}`);
      return null;
    } finally {
      this.running = false;
    }
  }
}
