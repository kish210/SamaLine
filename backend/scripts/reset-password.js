/**
 * تعیین رمز موقت برای یک کاربر پنل — وقتی ایمیل سامانه تنظیم نشده و کاربر
 * نمی‌تواند از «فراموشی رمز» استفاده کند.
 *
 *   npm run reset-password -- user@example.com
 *
 * رمز موقت تصادفی چاپ می‌شود؛ آن را به کاربر بدهید و بخواهید پس از ورود از
 * «تنظیمات ← تغییر رمز» عوضش کند. همه‌ی نشست‌های قبلی کاربر باطل می‌شوند.
 */
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');

if ((process.env.DB_DRIVER ?? 'sqlite') !== 'sqlite') {
  console.error('این اسکریپت فقط برای SQLite است.');
  process.exit(1);
}

const email = (process.argv[2] ?? '').trim().toLowerCase();
if (!email || email.startsWith('--')) {
  console.error('ایمیل کاربر را بدهید. مثال: npm run reset-password -- user@example.com');
  process.exit(1);
}

const db = new Database(
  path.resolve(__dirname, '..', process.env.SQLITE_PATH ?? 'data/samaline.sqlite'),
);

const hasColumn = db
  .prepare("PRAGMA table_info('users')")
  .all()
  .some((c) => c.name === 'passwordChangedAt');
if (!hasColumn) {
  console.error('اسکیما قدیمی است. یک بار برنامه را اجرا کنید تا به‌روز شود.');
  process.exit(1);
}

const user = db.prepare('select id from users where email = ?').get(email);
if (!user) {
  console.error(`کاربری با ایمیل ${email} پیدا نشد.`);
  process.exit(1);
}

// بدون نویسه‌های گیج‌کننده (0/O، 1/l) تا تلفنی هم قابل خواندن باشد.
const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const temp = Array.from(randomBytes(12), (b) => alphabet[b % alphabet.length]).join('');

// همان گرد کردن به ثانیه‌ی سرور، تا توکن‌های قبلی باطل شوند.
const changedAt = new Date(Math.floor(Date.now() / 1000) * 1000).toISOString();

db.prepare(
  `update users set passwordHash = ?, passwordChangedAt = ?,
   passwordResetHash = NULL, passwordResetExpiresAt = NULL where id = ?`,
).run(bcrypt.hashSync(temp, 10), changedAt.replace('T', ' ').replace('Z', ''), user.id);

console.log(`رمز موقت ${email}:\n\n  ${temp}\n`);
console.log('پس از ورود، از «تنظیمات ← تغییر رمز» آن را عوض کنید. نشست‌های قبلی باطل شدند.');
