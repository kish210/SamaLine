#!/usr/bin/env bash
#
# استقرار SamaLine روی یک سرور لینوکسی — روی خودِ سرور اجرا می‌شود.
#
# همه‌چیز خوداتکاست: نه داکر، نه nginx، نه پایگاه‌داده‌ی جداگانه. یک پروسه‌ی
# Node روی یک پورت، هم API را می‌دهد هم پنل و هم فرم را.
#
#   bash scripts/deploy.sh              اجرا روی پورت پیش‌فرض ۸۰۸۰
#   PORT=9000 bash scripts/deploy.sh    پورت دلخواه
#
set -euo pipefail

# اگر کاربر پورت داده باشد، همان استفاده می‌شود و جست‌وجوی خودکار انجام نمی‌شود.
if [ -n "${PORT:-}" ]; then PORT_EXPLICIT=1; fi
PORT="${PORT:-8080}"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE_NAME="${SERVICE_NAME:-samaline}"
NODE_MAJOR="${NODE_MAJOR:-22}"
# حداقل نسخه‌ای که vite و nest می‌پذیرند.
NODE_MIN="${NODE_MIN:-20}"

log() { printf '\n\033[36m==> %s\033[0m\n' "$1"; }
fail() { printf '\n\033[31mخطا: %s\033[0m\n' "$1" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || fail "این اسکریپت باید با root اجرا شود."

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
if port_busy "$PORT"; then
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

# better-sqlite3 ماژول بومی است و بدون ابزار ساخت کامپایل نمی‌شود.
if ! command -v cc >/dev/null 2>&1 || ! command -v python3 >/dev/null 2>&1; then
  echo "نصب ابزار ساخت…"
  apt-get install -y build-essential python3 >/dev/null
fi

log "نصب وابستگی‌ها"
cd "$APP_DIR"
# وابستگی‌های توسعه لازم‌اند: nest و vite هر دو devDependency‌اند و بدونشان
# build انجام نمی‌شود. پس از build با prune حذف می‌شوند تا دیسک آزاد بماند.
npm --prefix backend install
npm --prefix form-renderer install
npm --prefix panel install

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

log "ساخت فایل تنظیمات"
ENV_FILE="$APP_DIR/backend/.env"
if [ ! -f "$ENV_FILE" ]; then
  # کلیدها یک بار ساخته می‌شوند و بعد دست‌نخورده می‌مانند؛ عوض شدنشان یعنی
  # همه‌ی توکن‌های صادرشده و داده‌ی رمزشده از کار می‌افتد.
  cat > "$ENV_FILE" <<EOF
NODE_ENV=production
PORT=$PORT
DB_DRIVER=sqlite
SQLITE_PATH=data/samaline.sqlite
UPLOAD_DIR=data/uploads
JWT_SECRET=$(openssl rand -hex 32)
RESPONDENT_KEY_SALT=$(openssl rand -hex 16)
SECRET_BOX_KEY=$(openssl rand -hex 32)
EOF
  chmod 600 "$ENV_FILE"
  echo "backend/.env ساخته شد."
else
  # پورت را به‌روز می‌کنیم ولی کلیدها را دست نمی‌زنیم.
  sed -i "s/^PORT=.*/PORT=$PORT/" "$ENV_FILE"
  echo "backend/.env از قبل وجود داشت؛ فقط PORT به‌روز شد."
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
ExecStart=$(command -v node) dist/main
Restart=always
RestartSec=5
StandardOutput=append:/var/log/${SERVICE_NAME}.log
StandardError=append:/var/log/${SERVICE_NAME}.log

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$SERVICE_NAME" >/dev/null
systemctl restart "$SERVICE_NAME"

log "باز کردن پورت در فایروال"
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow "$PORT/tcp" >/dev/null
fi

log "بررسی سلامت"
for _ in $(seq 1 30); do
  if curl -fsS -o /dev/null "http://127.0.0.1:$PORT/api/docs"; then
    IP="$(curl -fsS --max-time 5 https://api.ipify.org || hostname -I | awk '{print $1}')"
    printf '\n\033[32mبالا آمد.\033[0m\n'
    echo "  فرم‌ها:   http://$IP:$PORT/"
    echo "  پنل:      http://$IP:$PORT/panel"
    echo "  مستندات:  http://$IP:$PORT/api/docs"
    echo
    echo "لاگ:      journalctl -u $SERVICE_NAME -f"
    echo "توقف:     systemctl stop $SERVICE_NAME"
    exit 0
  fi
  sleep 2
done

journalctl -u "$SERVICE_NAME" -n 40 --no-pager || tail -40 "/var/log/${SERVICE_NAME}.log"
fail "سرویس بالا نیامد. لاگ بالا را ببینید."
