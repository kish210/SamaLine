// اسکریپت داده‌ی اولیه — بدون نیاز به هیچ ابزار بیرونی: `npm run db:seed`
import 'dotenv/config';
import { appDataSource } from './data-source';
import { runMigrations } from './migrate-on-boot';
import { DEFAULT_PLAN_LIMITS, ensureDefaultPlans } from './plan-defaults';

export { DEFAULT_PLAN_LIMITS };

/**
 * ساخت اسکیما و بازنشانی پلن‌ها به مقدار پیش‌فرض.
 *
 * مهاجرت‌ها اول اجرا می‌شوند؛ پیش از این روی پایگاه‌داده‌ی تازه با «جدول
 * plan_policies وجود ندارد» شکست می‌خورد و `npm run release` هرگز بالا
 * نمی‌آمد. برنامه خودش هنگام بالا آمدن پلن‌های ناموجود را می‌سازد، پس این
 * دستور فقط برای برگرداندن سقف‌ها به پیش‌فرض لازم است.
 */
async function seed() {
  const ds = await appDataSource.initialize();
  await runMigrations(ds);

  const changed = await ensureDefaultPlans(ds, { overwrite: true });
  for (const code of changed) console.log(`پلن ${code} ثبت شد`);

  await ds.destroy();
  console.log('داده‌ی اولیه با موفقیت ثبت شد.');
}

void seed().catch((error) => {
  console.error('خطا در ثبت داده‌ی اولیه:', error);
  process.exit(1);
});
