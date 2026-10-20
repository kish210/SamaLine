/**
 * تنظیم سرویس هوش مصنوعی سامانه از خط فرمان سرور.
 *
 * همان کاری که پنل سوپرادمین می‌کند، ولی بدون نیاز به ورود — برای وقتی که
 * می‌خواهید مدل را روی سرور عوض کنید یا AI را خاموش کنید.
 *
 *   node scripts/set-ai.js --show
 *   node scripts/set-ai.js --off
 *   node scripts/set-ai.js --provider openai \
 *       --base-url http://127.0.0.1:11434/v1 --model qwen2.5:1.5b
 *   node scripts/set-ai.js --provider openai --base-url https://api.openai.com/v1 \
 *       --model gpt-4o-mini --key sk-...
 *
 * برای مدل محلی (Ollama) کلید لازم نیست. کلید، در صورت دادن، رمزشده ذخیره
 * می‌شود (همان رمزنگاری سطح ستونِ برنامه).
 */
const path = require('node:path');
const Database = require('better-sqlite3');

const dbPath = path.resolve(
  __dirname,
  '..',
  process.env.SQLITE_PATH ?? 'data/samaline.sqlite',
);

// رمزنگاری کلید از همان ماژول برنامه؛ اگر هنوز build نشده، بی‌کلید ادامه می‌دهیم.
let encryptSecret = (v) => v;
try {
  ({ encryptSecret } = require('../dist/common/secret-box'));
} catch {
  /* قبل از build: فقط مدل محلیِ بی‌کلید قابل تنظیم است. */
}

const args = process.argv.slice(2);
const getOpt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const show = args.includes('--show');
const off = args.includes('--off');

const db = new Database(dbPath);

const hasTable = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='platform_settings'")
  .get();
if (!hasTable) {
  console.error('جدول platform_settings نیست. یک بار برنامه را اجرا کنید تا اسکیما ساخته شود.');
  process.exit(1);
}

// ردیف تک‌تایی تنظیمات سکو را تضمین می‌کنیم.
db.prepare(
  `INSERT OR IGNORE INTO platform_settings (id, footerEnabled, footerText, footerUrl)
   VALUES ('singleton', 1, '', '')`,
).run();

const current = db
  .prepare('SELECT aiProvider, aiBaseUrl, aiModel, aiApiKey FROM platform_settings WHERE id = ?')
  .get('singleton');

if (show) {
  console.log('تنظیمات هوش مصنوعی:');
  console.log(`  سرویس‌دهنده: ${current.aiProvider || 'mock'}`);
  console.log(`  نشانی پایه:  ${current.aiBaseUrl || '—'}`);
  console.log(`  مدل:         ${current.aiModel || '—'}`);
  console.log(`  کلید:        ${current.aiApiKey ? '*** (تنظیم‌شده)' : '—'}`);
  process.exit(0);
}

if (off) {
  db.prepare("UPDATE platform_settings SET aiProvider = 'mock' WHERE id = 'singleton'").run();
  console.log('هوش مصنوعی خاموش شد (حالت نمونه).');
  process.exit(0);
}

const provider = getOpt('--provider');
const baseUrl = getOpt('--base-url');
const model = getOpt('--model');
const key = getOpt('--key');

if (!provider && !baseUrl && !model && key === undefined) {
  console.error('کاری داده نشد. از --show، --off یا --provider/--base-url/--model/--key استفاده کنید.');
  process.exit(1);
}

if (provider !== undefined) {
  const p = provider === 'openai' ? 'openai' : 'mock';
  db.prepare('UPDATE platform_settings SET aiProvider = ? WHERE id = ?').run(p, 'singleton');
}
if (baseUrl !== undefined) {
  db.prepare('UPDATE platform_settings SET aiBaseUrl = ? WHERE id = ?').run(baseUrl, 'singleton');
}
if (model !== undefined) {
  db.prepare('UPDATE platform_settings SET aiModel = ? WHERE id = ?').run(model, 'singleton');
}
if (key !== undefined) {
  // «-» یعنی پاک کردن؛ وگرنه رمزشده ذخیره می‌شود.
  const stored = key === '-' ? '' : encryptSecret(key);
  db.prepare('UPDATE platform_settings SET aiApiKey = ? WHERE id = ?').run(stored, 'singleton');
}

const after = db
  .prepare('SELECT aiProvider, aiBaseUrl, aiModel, aiApiKey FROM platform_settings WHERE id = ?')
  .get('singleton');
console.log('به‌روزرسانی شد:');
console.log(`  سرویس‌دهنده: ${after.aiProvider || 'mock'}`);
console.log(`  نشانی پایه:  ${after.aiBaseUrl || '—'}`);
console.log(`  مدل:         ${after.aiModel || '—'}`);
console.log(`  کلید:        ${after.aiApiKey ? '*** (تنظیم‌شده)' : '—'}`);
