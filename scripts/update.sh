#!/usr/bin/env bash
#
# به‌روزرسانی SamaLine روی سرور: آخرین نسخه از گیت + استقرار دوباره.
#
#   bash scripts/update.sh
#
# داده (backend/data)، کلیدها (backend/.env) و پورت دست نمی‌خورند. پیش از
# هر تغییر اسکیما، برنامه خودش از پایگاه‌داده پشتیبان می‌گیرد.
#
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

[ "$(id -u)" -eq 0 ] || { echo "باید با root اجرا شود." >&2; exit 1; }

# فقط پیش‌روی ساده؛ اگر روی سرور تغییر دستی داده شده باشد، به‌جای ادغام
# بی‌صدا متوقف می‌شود تا کسی تصمیم بگیرد.
git pull --ff-only

exec bash "$APP_DIR/scripts/deploy.sh"
