/**
 * خاموش کردن ورود دومرحله‌ای یک کاربر — برای وقتی که گوشی‌اش گم شده.
 *
 * فقط از خط فرمان سرور؛ هیچ اندپوینتی برای دور زدن ۲FA وجود ندارد.
 *
 *   npm run reset-2fa -- user@example.com
 *   npm run reset-2fa -- --list        فهرست کاربرانی که ۲FA دارند
 */
const path = require('node:path');
const Database = require('better-sqlite3');

if ((process.env.DB_DRIVER ?? 'sqlite') !== 'sqlite') {
  console.error(
    'این اسکریپت فقط برای SQLite است. روی Postgres:\n' +
      `  UPDATE users SET "totpEnabled" = false, "totpSecret" = NULL, "totpLastStep" = NULL WHERE email = '...';`,
  );
  process.exit(1);
}

const dbPath = path.resolve(
  __dirname,
  '..',
  process.env.SQLITE_PATH ?? 'data/samaline.sqlite',
);

const args = process.argv.slice(2);
const list = args.includes('--list');
const email = args.find((a) => !a.startsWith('--'));

const db = new Database(dbPath);

const hasColumn = db
  .prepare("PRAGMA table_info('users')")
  .all()
  .some((c) => c.name === 'totpEnabled');
if (!hasColumn) {
  console.error('ستون totpEnabled وجود ندارد. یک بار برنامه را اجرا کنید تا اسکیما به‌روز شود.');
  process.exit(1);
}

if (list) {
  const rows = db.prepare('select email from users where totpEnabled = 1').all();
  console.log(
    rows.length
      ? `کاربران با ورود دومرحله‌ای:\n${rows.map((r) => '  - ' + r.email).join('\n')}`
      : 'هیچ کاربری ورود دومرحله‌ای ندارد.',
  );
  process.exit(0);
}

if (!email) {
  console.error('ایمیل کاربر را بدهید. مثال: npm run reset-2fa -- user@example.com');
  process.exit(1);
}

const user = db
  .prepare('select id from users where email = ?')
  .get(email.toLowerCase());
if (!user) {
  console.error(`کاربری با ایمیل ${email} پیدا نشد.`);
  process.exit(1);
}

db.prepare(
  'update users set totpEnabled = 0, totpSecret = NULL, totpLastStep = NULL where id = ?',
).run(user.id);

console.log(`ورود دومرحله‌ای ${email} خاموش شد. کاربر می‌تواند فقط با رمز وارد شود.`);
