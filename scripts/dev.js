#!/usr/bin/env node
/**
 * اجرای هم‌زمان هر سه سرویس برای توسعه و تست.
 *
 * بدون هیچ وابستگی جدید (نه concurrently نه docker) — فقط child_process،
 * چون شرط پروژه این است که همه‌چیز خوداتکا باشد.
 *
 *   npm run dev          هر سه سرویس
 *   npm run dev backend  فقط یکی
 *
 * با Ctrl+C همه با هم بسته می‌شوند.
 */
const { spawn } = require('node:child_process');
const { existsSync } = require('node:fs');
const { join } = require('node:path');

const ROOT = join(__dirname, '..');

const SERVICES = [
  { name: 'backend', dir: 'backend', script: 'start:dev', color: '\x1b[36m' },
  { name: 'renderer', dir: 'form-renderer', script: 'dev', color: '\x1b[32m' },
  { name: 'panel', dir: 'panel', script: 'dev', color: '\x1b[35m' },
];

const RESET = '\x1b[0m';
const DIM = '\x1b[2m';

const requested = process.argv.slice(2);
const selected = requested.length
  ? SERVICES.filter((s) => requested.includes(s.name))
  : SERVICES;

if (selected.length === 0) {
  console.error(
    `سرویسی با این نام نیست. گزینه‌ها: ${SERVICES.map((s) => s.name).join('، ')}`,
  );
  process.exit(1);
}

for (const service of selected) {
  if (!existsSync(join(ROOT, service.dir, 'node_modules'))) {
    console.error(
      `${service.dir}/node_modules پیدا نشد. اول در همان پوشه npm install بزنید.`,
    );
    process.exit(1);
  }
}

const children = [];
let shuttingDown = false;

/** خروجی هر سرویس با نام و رنگ خودش پیشوند می‌گیرد. */
function prefixed(service, chunk) {
  const label = `${service.color}[${service.name}]${RESET}`;
  return String(chunk)
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => `${label} ${line}`)
    .join('\n');
}

for (const service of selected) {
  const child = spawn('npm', ['run', service.script], {
    cwd: join(ROOT, service.dir),
    // npm روی ویندوز یک فایل .cmd است و بدون shell اجرا نمی‌شود.
    shell: true,
    env: process.env,
  });

  child.stdout.on('data', (chunk) => {
    const text = prefixed(service, chunk);
    if (text) console.log(text);
  });

  child.stderr.on('data', (chunk) => {
    const text = prefixed(service, chunk);
    if (text) console.error(text);
  });

  child.on('exit', (code) => {
    if (shuttingDown) return;
    console.error(
      `${service.color}[${service.name}]${RESET} با کد ${code} بسته شد.`,
    );
    // بستن یک سرویس یعنی محیط ناقص است؛ بقیه هم بسته می‌شوند تا وضعیت
    // نیمه‌کاره‌ای که سردرگم‌کننده است باقی نماند.
    shutdown(code ?? 1);
  });

  children.push(child);
}

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log(
  `${DIM}در حال اجرا: ${selected.map((s) => s.name).join('، ')}${RESET}`,
);
console.log(`${DIM}بک‌اند http://localhost:3000/api/docs${RESET}`);
console.log(`${DIM}فرم    http://localhost:5173${RESET}`);
console.log(`${DIM}پنل    http://localhost:5174${RESET}`);
console.log(`${DIM}توقف: Ctrl+C${RESET}\n`);
