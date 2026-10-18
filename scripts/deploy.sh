#!/usr/bin/env bash
#
# استقرار SamaLine روی یک سرور لینوکسی — روی خودِ سرور اجرا می‌شود.
#
# همه‌چیز خوداتکاست: نه داکر، نه nginx، نه پایگاه‌داده‌ی جداگانه. یک پروسه‌ی
# Node روی یک پورت، هم API را می‌دهد هم پنل و هم فرم را.
#
#   bash scripts/deploy.sh              HTTP روی ۸۰ و HTTPS روی ۴۴۳
#   PORT=9000 bash scripts/deploy.sh    پورت HTTP دلخواه
#   TLS=0 bash scripts/deploy.sh        فقط HTTP (بدون ۴۴۳)
#   TLS_CERT=... TLS_KEY=... bash scripts/deploy.sh   گواهی واقعی خودتان
#
set -euo pipefail

# اگر کاربر پورت داده باشد، همان استفاده می‌شود و جست‌وجوی خودکار انجام نمی‌شود.
if [ -n "${PORT:-}" ]; then PORT_EXPLICIT=1; fi
# پیش‌فرضِ انتشار: HTTP روی ۸۰ و HTTPS روی ۴۴۳.
PORT="${PORT:-80}"
HTTPS_PORT="${HTTPS_PORT:-443}"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE_NAME="${SERVICE_NAME:-samaline}"
NODE_MAJOR="${NODE_MAJOR:-22}"
# حداقل نسخه‌ای که vite و nest می‌پذیرند.
NODE_MIN="${NODE_MIN:-20}"
# TLS پیش‌فرض روشن است؛ با TLS=0 خاموش می‌شود.
TLS="${TLS:-1}"
CERT_DIR="$APP_DIR/backend/certs"

log() { printf '\n\033[36m==> %s\033[0m\n' "$1"; }
fail() { printf '\n\033[31mخطا: %s\033[0m\n' "$1" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || fail "این اسکریپت باید با root اجرا شود."

# نصب دوباره: اگر همین سرویس در حال اجراست، اول متوقفش می‌کنیم تا پورت‌های
# خودش (۸۰/۴۴۳) آزاد شوند. وگرنه بررسی «پورت اشغال است» پورتِ خودِ سرویسِ
# قدیمی را اشغال می‌بیند و HTTP را بی‌خود به ۸۱، ۸۲ … می‌راند و هر نصب دوباره
# پورت را جابه‌جا می‌کند.
if command -v systemctl >/dev/null 2>&1 &&
   systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
  echo "سرویس «$SERVICE_NAME» در حال اجراست؛ برای آزادشدن پورت‌ها متوقف می‌شود."
  systemctl stop "$SERVICE_NAME" || true
fi

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

# نشانیِ سرور برای SAN گواهی و پیام پایانی: IPِ محلیِ خودِ سرور، نه IP عمومیِ
# خروجی اینترنت. روی سرور on-prem پشت NAT، نشانیِ درست همین است.
SERVER_ADDR="${SERVER_ADDR:-$(hostname -I | awk '{print $1}')}"
[ -n "$SERVER_ADDR" ] || SERVER_ADDR="127.0.0.1"

log "گواهی TLS"
if [ "$TLS" = "1" ]; then
  # اگر کاربر گواهیِ خودش را نداده، یک گواهیِ self-signed می‌سازیم. سرور IP
  # محلی دارد و دامنه‌ی عمومی ندارد، پس Let's Encrypt ممکن نیست؛ برای گواهیِ
  # معتبر، TLS_CERT/TLS_KEY را خودتان بدهید.
  if [ -z "${TLS_CERT:-}" ] || [ -z "${TLS_KEY:-}" ]; then
    TLS_CERT="$CERT_DIR/server.crt"
    TLS_KEY="$CERT_DIR/server.key"
    if [ ! -f "$TLS_CERT" ] || [ ! -f "$TLS_KEY" ]; then
      mkdir -p "$CERT_DIR"
      openssl req -x509 -newkey rsa:2048 -nodes -days 3650 \
        -keyout "$TLS_KEY" -out "$TLS_CERT" \
        -subj "/CN=$SERVER_ADDR" \
        -addext "subjectAltName=IP:$SERVER_ADDR" >/dev/null 2>&1
      chmod 600 "$TLS_KEY"
      echo "گواهیِ self-signed ساخته شد (SAN=IP:$SERVER_ADDR)."
    else
      echo "گواهیِ موجود استفاده می‌شود."
    fi
  else
    echo "گواهیِ دستی: $TLS_CERT"
  fi
else
  echo "TLS خاموش است؛ فقط HTTP."
  TLS_CERT=""
  TLS_KEY=""
fi

log "ساخت فایل تنظیمات"
ENV_FILE="$APP_DIR/backend/.env"

# یک کلید را در .env درج یا به‌روز می‌کند بدون دست‌زدن به بقیه.
set_env() {
  local key="$1" value="$2"
  if grep -q "^$key=" "$ENV_FILE" 2>/dev/null; then
    # مقدار ممکن است / داشته باشد (مسیر گواهی)، پس جداکننده‌ی sed را | می‌گذاریم.
    sed -i "s|^$key=.*|$key=$value|" "$ENV_FILE"
  else
    printf '%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

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
  echo "backend/.env از قبل وجود داشت؛ کلیدهای رمز دست‌نخورده می‌مانند."
fi

# پورت‌ها و گواهی را روی .env (چه نو چه قدیمی) هم‌تراز می‌کنیم.
set_env PORT "$PORT"
set_env HTTPS_PORT "$HTTPS_PORT"
set_env TLS_CERT "$TLS_CERT"
set_env TLS_KEY "$TLS_KEY"

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
  [ -n "$TLS_CERT" ] && ufw allow "$HTTPS_PORT/tcp" >/dev/null
fi

# نشانیِ نمایشی: اگر TLS هست https/۴۴۳، وگرنه http/پورت.
if [ -n "$TLS_CERT" ]; then
  SCHEME="https"; PUB_PORT="$HTTPS_PORT"
else
  SCHEME="http"; PUB_PORT="$PORT"
fi
# پورت استاندارد (۸۰/۴۴۳) در نشانی نوشته نمی‌شود.
if { [ "$SCHEME" = "http" ] && [ "$PUB_PORT" = "80" ]; } ||
   { [ "$SCHEME" = "https" ] && [ "$PUB_PORT" = "443" ]; }; then
  BASE="$SCHEME://$SERVER_ADDR"
else
  BASE="$SCHEME://$SERVER_ADDR:$PUB_PORT"
fi

log "بررسی سلامت"
# تلاش‌ها بی‌صدا تا سرویس بالا بیاید؛ -k چون گواهی self-signed است. خطا را
# فقط در شکستِ نهایی نشان می‌دهیم تا خروجی گمراه‌کننده نباشد.
for _ in $(seq 1 30); do
  if curl -fsk -o /dev/null "$BASE/api/docs"; then
    printf '\n\033[32mبالا آمد.\033[0m\n'
    echo "  فرم‌ها:   $BASE/"
    echo "  پنل:      $BASE/panel"
    echo "  مستندات:  $BASE/api/docs"
    if [ -n "$TLS_CERT" ]; then
      echo
      echo "توجه: گواهی self-signed است؛ مرورگر هشدار می‌دهد. برای گواهیِ"
      echo "      معتبر، TLS_CERT و TLS_KEY را بدهید و دوباره اجرا کنید."
    fi
    echo
    echo "لاگ:      journalctl -u $SERVICE_NAME -f"
    echo "توقف:     systemctl stop $SERVICE_NAME"
    exit 0
  fi
  sleep 2
done

journalctl -u "$SERVICE_NAME" -n 40 --no-pager || tail -40 "/var/log/${SERVICE_NAME}.log"
fail "سرویس بالا نیامد. لاگ بالا را ببینید."
