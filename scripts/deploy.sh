#!/usr/bin/env bash
#
# استقرار SamaLine روی یک سرور لینوکسی — روی خودِ سرور اجرا می‌شود.
#
# همه‌چیز خوداتکاست: نه داکر، نه nginx، نه پایگاه‌داده‌ی جداگانه. یک پروسه‌ی
# Node روی یک پورت، هم API را می‌دهد هم پنل و هم فرم را.
#
#   bash scripts/deploy.sh              اجرا روی پورت پیش‌فرض ۸۰۸۰
#   PORT=9000 bash scripts/deploy.sh    پورت دلخواه
#   PUBLIC_URL=https://survey.example.com bash scripts/deploy.sh
#                                       نشانی عمومی (برای لینک پیامک و ایمیل)
#
# اجرای دوباره‌ی همین اسکریپت یعنی به‌روزرسانی: داده، کلیدها و پورت قبلی
# دست‌نخورده می‌مانند. برای گرفتن آخرین نسخه از گیت: bash scripts/update.sh
#
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$APP_DIR/backend/.env"
SERVICE_NAME="${SERVICE_NAME:-samaline}"
NODE_MAJOR="${NODE_MAJOR:-22}"
# حداقل نسخه‌ای که vite و nest می‌پذیرند.
NODE_MIN="${NODE_MIN:-20}"

log() { printf '\n\033[36m==> %s\033[0m\n' "$1"; }
fail() { printf '\n\033[31mخطا: %s\033[0m\n' "$1" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || fail "این اسکریپت باید با root اجرا شود."

# مقدار یک کلید از فایل تنظیمات موجود (یا خالی).
env_value() {
  [ -f "$ENV_FILE" ] || return 0
  grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2- || true
}

# افزودن یا جایگزینی یک کلید در فایل تنظیمات.
set_env() {
  if grep -qE "^$1=" "$ENV_FILE"; then
    sed -i "s|^$1=.*|$1=$2|" "$ENV_FILE"
  else
    printf '%s=%s\n' "$1" "$2" >> "$ENV_FILE"
  fi
}

# اگر کاربر پورت داده باشد، همان استفاده می‌شود و جست‌وجوی خودکار انجام نمی‌شود.
if [ -n "${PORT:-}" ]; then
  PORT_EXPLICIT=1
elif [ -n "$(env_value PORT)" ]; then
  # استقرار دوباره: پورت قبلی را سرویس خودمان گرفته است. نباید «اشغال»
  # شمرده شود، وگرنه سامانه بی‌خبر به پورت دیگری می‌رفت و لینک‌ها می‌شکستند.
  PORT="$(env_value PORT)"
  PORT_REUSED=1
fi
PORT="${PORT:-8080}"

# آیا این پورت روی سرور در حال استفاده است؟
port_busy() {
  local p="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -ltnH "sport = :$p" 2>/dev/null | grep -q .
  elif command -v netstat >/dev/null 2>&1; then
    netstat -ltn 2>/dev/null | grep -qE "[:.]$p[[:space:]]"
  else
    # بدون ابزار بررسی، محتاطانه اشغال فرض نمی‌کنیم.
    return 1
  fi
}

log "انتخاب پورت"
if [ -n "${PORT_REUSED:-}" ]; then
  echo "استقرار دوباره؛ پورت قبلی حفظ می‌شود."
elif port_busy "$PORT"; then
  if [ -n "${PORT_EXPLICIT:-}" ]; then
    fail "پورت $PORT اشغال است."
  fi
  # پورت درخواستی گرفته است؛ اولین پورت آزاد بعدی انتخاب می‌شود تا با
  # سرویس‌های در حال اجرای سرور تداخل نکند.
  echo "پورت $PORT اشغال است؛ دنبال پورت آزاد می‌گردم…"
  for candidate in $(seq "$((PORT + 1))" "$((PORT + 60))"); do
    if ! port_busy "$candidate"; then
      PORT="$candidate"
      break
    fi
  done
  port_busy "$PORT" && fail "پورت آزادی پیدا نشد. با PORT=... خودتان بدهید."
fi
echo "پورت انتخاب‌شده: $PORT"

log "بررسی Node.js"
if command -v node >/dev/null 2>&1; then
  CURRENT_NODE="$(node -p 'process.versions.node.split(".")[0]')"
else
  CURRENT_NODE=0
fi

if [ "$CURRENT_NODE" -ge "$NODE_MIN" ]; then
  # روی سرور مشترک، Node موجود ممکن است زیر پای اپ‌های دیگر باشد.
  # ارتقای آن می‌تواند سرویس‌های در حال اجرا را بشکند، پس اگر نسخه‌ی
  # موجود کافی است دست‌نخورده می‌ماند.
  echo "Node $(node -v) موجود است و کافی است؛ دست نمی‌خورد."
else
  if [ -n "${ALLOW_NODE_INSTALL:-}" ]; then
    echo "Node موجود کافی نیست؛ نصب نسخه $NODE_MAJOR…"
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
    apt-get install -y nodejs
  else
    fail "Node نسخه $NODE_MIN یا بالاتر لازم است (نسخه‌ی فعلی: ${CURRENT_NODE:-ندارد}).
نصب خودکار عمدا انجام نمی‌شود چون ممکن است Node اپ‌های دیگر همین سرور را
عوض کند. اگر مطمئنید، با ALLOW_NODE_INSTALL=1 دوباره اجرا کنید."
  fi
fi

# better-sqlite3 ماژول بومی است. برای لینوکس ۶۴بیتی نسخه‌ی آماده دارد، ولی
# اگر نسخه‌ی آماده نباشد، بدون ابزار ساخت کامپایل نمی‌شود.
if ! command -v cc >/dev/null 2>&1 || ! command -v python3 >/dev/null 2>&1; then
  if command -v apt-get >/dev/null 2>&1; then
    echo "نصب ابزار ساخت…"
    apt-get install -y build-essential python3 >/dev/null || true
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y gcc-c++ make python3 >/dev/null || true
  fi
fi

log "نصب وابستگی‌ها"
cd "$APP_DIR"
# npm ci دقیقا همان نسخه‌های قفل‌شده در package-lock را نصب می‌کند؛ پایدارتر
# از install که ممکن است روی سرور نسخه‌ی تازه‌تری از یک وابستگی بگیرد.
# وابستگی‌های توسعه لازم‌اند: nest و vite هر دو devDependency‌اند و بدونشان
# build انجام نمی‌شود. پس از build با prune حذف می‌شوند تا دیسک آزاد بماند.
npm --prefix backend ci --no-audit --no-fund
npm --prefix form-renderer ci --no-audit --no-fund
npm --prefix panel ci --no-audit --no-fund

log "ساخت"
# رندرر و پنل باید API را روی همین میزبان و همین پورت صدا بزنند، نه localhost.
# نشانی API نسبی است تا فرقی نکند سرور روی کدام دامنه یا پورت بالا می‌آید.
VITE_API_URL="/api/v1" npm --prefix form-renderer run build
# پنل زیر /panel سرو می‌شود؛ base در vite.config.ts همان را می‌گذارد.
VITE_API_URL="/api/v1" npm --prefix panel run build
npm --prefix backend run build

log "پاک‌سازی وابستگی‌های توسعه"
# فقط بک‌اند در زمان اجرا به node_modules نیاز دارد؛ خروجی build دو اپ
# دیگر فایل استاتیک است و node_modules‌شان دیگر لازم نیست.
npm --prefix backend prune --omit=dev >/dev/null 2>&1 || true
rm -rf "$APP_DIR/form-renderer/node_modules" "$APP_DIR/panel/node_modules"

log "نشانی عمومی"
# نشانی‌ای که کاربران فرم را با آن باز می‌کنند؛ لینک‌های پیامک، ایمیل و
# یادآوری از روی همین ساخته می‌شوند. بدون آن، لینک یادآوری ناقص می‌رفت.
if [ -z "${PUBLIC_URL:-}" ]; then
  PUBLIC_URL="$(env_value PUBLIC_URL)"
fi
if [ -z "${PUBLIC_URL:-}" ]; then
  HOST_IP="$(curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')"
  PUBLIC_URL="http://${HOST_IP}:${PORT}"
fi
PUBLIC_URL="${PUBLIC_URL%/}"
echo "نشانی عمومی: $PUBLIC_URL"

log "ساخت فایل تنظیمات"
if [ ! -f "$ENV_FILE" ]; then
  # کلیدها یک بار ساخته می‌شوند و بعد دست‌نخورده می‌مانند؛ عوض شدنشان یعنی
  # همه‌ی توکن‌های صادرشده و داده‌ی رمزشده از کار می‌افتد.
  umask 077
  {
    echo "NODE_ENV=production"
    echo "PORT=$PORT"
    echo "DB_DRIVER=sqlite"
    echo "SQLITE_PATH=data/samaline.sqlite"
    echo "UPLOAD_DIR=data/uploads"
    echo "JWT_SECRET=$(openssl rand -hex 32)"
    echo "RESPONDENT_KEY_SALT=$(openssl rand -hex 16)"
    echo "SECRET_ENCRYPTION_KEY=$(openssl rand -hex 32)"
    echo "PUBLIC_URL=$PUBLIC_URL"
    echo "PUBLIC_FORM_BASE_URL=$PUBLIC_URL/f"
  } > "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  echo "backend/.env ساخته شد."
else
  # پورت و نشانی‌ها به‌روز می‌شوند ولی کلیدها دست نمی‌خورند.
  #
  # نسخه‌های قبلی این اسکریپت کلید رمزنگاری را با نام اشتباه SECRET_BOX_KEY
  # می‌نوشتند که برنامه آن را نمی‌خواند؛ پس داده‌ی رمزشده‌ی آن نصب‌ها با
  # JWT_SECRET رمز شده است. افزودن SECRET_ENCRYPTION_KEY اینجا آن داده را
  # غیرقابل‌خواندن می‌کرد، برای همین عمدا اضافه نمی‌شود.
  set_env PORT "$PORT"
  set_env PUBLIC_URL "$PUBLIC_URL"
  set_env PUBLIC_FORM_BASE_URL "$PUBLIC_URL/f"
  echo "backend/.env از قبل وجود داشت؛ فقط پورت و نشانی‌ها به‌روز شد."
fi

log "ساخت سرویس systemd"
cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=SamaLine — سامانه نظرسنجی
After=network.target

[Service]
Type=simple
WorkingDirectory=$APP_DIR/backend
EnvironmentFile=$APP_DIR/backend/.env
Environment=NODE_ENV=production
ExecStart=$(command -v node) dist/main
Restart=always
RestartSec=5
# فرصت بستن مرتب دیتابیس پیش از کشتن اجباری.
TimeoutStopSec=20
LimitNOFILE=65536
# لاگ به journald می‌رود که خودش چرخش و سقف حجم دارد؛ فایل لاگ ساده بی‌انتها
# بزرگ می‌شد و دیسک را پر می‌کرد.
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${SERVICE_NAME}

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$SERVICE_NAME" >/dev/null
systemctl restart "$SERVICE_NAME"

log "باز کردن پورت در فایروال"
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow "$PORT/tcp" >/dev/null
elif command -v firewall-cmd >/dev/null 2>&1 && firewall-cmd --state >/dev/null 2>&1; then
  firewall-cmd --permanent --add-port="$PORT/tcp" >/dev/null
  firewall-cmd --reload >/dev/null
fi

log "بررسی سلامت"
for _ in $(seq 1 30); do
  if curl -fsS -o /dev/null "http://127.0.0.1:$PORT/api/v1/health"; then
    printf '\n\033[32mبالا آمد.\033[0m\n'
    echo "  فرم‌ها:    $PUBLIC_URL/"
    echo "  پنل:       $PUBLIC_URL/panel"
    echo "  مستندات:   $PUBLIC_URL/api/docs"
    echo "  سلامت:     $PUBLIC_URL/api/v1/health"
    echo
    echo "لاگ:         journalctl -u $SERVICE_NAME -f"
    echo "توقف:        systemctl stop $SERVICE_NAME"
    echo "پشتیبان:     $APP_DIR/backend/data/backups/daily (روزانه، خودکار)"
    echo "مدیر کل:     cd $APP_DIR/backend && npm run superadmin -- you@example.com"
    exit 0
  fi
  sleep 2
done

journalctl -u "$SERVICE_NAME" -n 40 --no-pager || true
fail "سرویس بالا نیامد. لاگ بالا را ببینید."
