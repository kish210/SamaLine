/**
 * تعیین یا لغو سوپرادمین سکو.
 *
 * عمدا فقط از خط فرمان سرور قابل اجراست و هیچ اندپوینتی برای ارتقای خود
 * وجود ندارد؛ وگرنه هر کاربری می‌توانست خودش را مدیر کل کند.
 *
 *   node scripts/grant-superadmin.js user@example.com
 *   node scripts/grant-superadmin.js user@example.com --revoke
 *   node scripts/grant-superadmin.js --list
 */
const path = require('node:path');
const Database = require('better-sqlite3');

const dbPath = path.resolve(
  __dirname,
  '..',
  process.env.SQLITE_PATH ?? 'data/samaline.sqlite',
);

const args = process.argv.slice(2);
const revoke = args.includes('--revoke');
const list = args.includes('--list');
const email = args.find((a) => !a.startsWith('--'));

const db = new Database(dbPath);

const hasColumn = db
  .prepare("PRAGMA table_info('users')")
  .all()
  .some((c) => c.name === 'isSuperAdmin');

if (!hasColumn) {
  console.error(
    'ستون isSuperAdmin وجود ندارد. یک بار برنامه را اجرا کنید تا اسکیما ساخته شود.',
  );
  process.exit(1);
}

if (list) {
  const rows = db
    .prepare('select email from users where isSuperAdmin = 1')
    .all();
  console.log(
    rows.length
      ? `سوپرادمین‌ها:\n${rows.map((r) => '  - ' + r.email).join('\n')}`
      : 'هیچ سوپرادمینی تعیین نشده است.',
  );
  process.exit(0);
}

if (!email) {
  console.error('ایمیل کاربر را بدهید. مثال: node scripts/grant-superadmin.js admin@example.com');
  process.exit(1);
}

const user = db.prepare('select id, email from users where email = ?').get(email);
if (!user) {
  console.error(`کاربری با ایمیل ${email} پیدا نشد.`);
  process.exit(1);
}

db.prepare('update users set isSuperAdmin = ? where id = ?').run(
  revoke ? 0 : 1,
  user.id,
);

console.log(
  revoke
    ? `نقش سوپرادمین از ${email} گرفته شد.`
    : `${email} حالا سوپرادمین سکوست.`,
);
