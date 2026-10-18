#!/usr/bin/env bash
#
# راه‌انداز نصب SamaLine روی یک سرور تازه‌ی لینوکسی.
#
# این اسکریپت را *پس از* آوردن کد روی سرور اجرا کنید (git clone یا کپی). کارش
# نصب پیش‌نیازهای سبک و سپس اجرای deploy.sh با اجازه‌ی نصب Node است؛ همه‌چیز
# دیگر (ساخت، گواهی TLS، سرویس systemd، پورت ۸۰/۴۴۳) را deploy.sh انجام می‌دهد.
#
#   sudo bash scripts/install.sh
#   PUBLIC_URL=https://survey.example.com sudo -E bash scripts/install.sh
#
# ── نصب روی سرور تازه از روی گیت (مخزن خصوصی) ──────────────────────────────
# چون مخزن خصوصی است، کلون به یک توکن گیت‌هاب (با دسترسی خواندن repo) نیاز دارد:
#
#   sudo apt-get update && sudo apt-get install -y git
#   git clone https://<GITHUB_TOKEN>@github.com/kish210/SamaLine.git ~/SamaLine
#   cd ~/SamaLine && sudo bash scripts/install.sh
#
# اگر مخزن را عمومی کنید، به‌جای توکن فقط نشانی ساده‌ی https کافی است.
# برای به‌روزرسانی نصبِ موجود از گیت: sudo bash scripts/update.sh
#
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[ "$(id -u)" -eq 0 ] || { echo "با sudo اجرا کنید: sudo bash scripts/install.sh" >&2; exit 1; }

echo "نصب پیش‌نیازها…"
if command -v apt-get >/dev/null 2>&1; then
  apt-get update -y >/dev/null 2>&1 || true
  apt-get install -y git curl openssl ca-certificates >/dev/null 2>&1 || true
elif command -v dnf >/dev/null 2>&1; then
  dnf install -y git curl openssl ca-certificates >/dev/null 2>&1 || true
fi

# Node در deploy.sh نصب می‌شود؛ اینجا فقط اجازه‌اش را می‌دهیم تا نصب روی سرور
# تازه بدون گام دستیِ اضافه کامل شود.
exec env ALLOW_NODE_INSTALL=1 bash "$APP_DIR/scripts/deploy.sh"
