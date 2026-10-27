#!/usr/bin/env bash
#
# گواهیِ معتبرِ Let's Encrypt برای SamaLine — صدور، تمدید و نصب.
#
#   sudo bash scripts/tls-letsencrypt.sh                 دامنه از PUBLIC_URL
#   sudo bash scripts/tls-letsencrypt.sh survey.example.com
#
# با acme.sh کار می‌کند (پیش‌فرض ‎/root/.acme.sh‎). خودِ برنامه پورت ۴۴۳ را
# گرفته است، پس چالشِ ALPN (روی ۴۴۳) فقط وقتی جواب می‌دهد که سرویس چند ثانیه
# کنار برود: صدور و تمدید با هوکِ stop/start انجام می‌شوند و همین هوک‌ها در
# تنظیماتِ acme ذخیره می‌شوند تا تمدیدِ خودکارِ cron هم بی‌دخالت کار کند.
# (روی سرورهایی که پورت ۸۰ از بیرون باز است، ACME_MODE=standalone هم شدنی است.)
#
# اجرای دوباره بی‌خطر است: اگر گواهی موعدِ تمدید نداشته باشد فقط نصب می‌شود.
# deploy.sh (و در نتیجه update.sh) پس از هر به‌روزرسانی همین را صدا می‌زند، تا
# گواهیِ self-signed هرگز جای گواهیِ معتبر را نگیرد.
#
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$APP_DIR/backend/.env"
CERT_DIR="$APP_DIR/backend/certs"
SERVICE_NAME="${SERVICE_NAME:-samaline}"
ACME_HOME="${ACME_HOME:-/root/.acme.sh}"
ACME="$ACME_HOME/acme.sh"
# alpn: چالش روی ۴۴۳ (پیش‌فرض؛ وقتی پورت ۸۰ از بیرون بسته است).
# standalone: چالشِ http-01 روی ۸۰.
ACME_MODE="${ACME_MODE:-alpn}"

log() { printf '\n\033[36m==> %s\033[0m\n' "$1"; }
warn() { printf '\033[33m%s\033[0m\n' "$1"; }
fail() { printf '\n\033[31mخطا: %s\033[0m\n' "$1" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || fail "این اسکریپت باید با root اجرا شود."

env_value() {
  [ -f "$ENV_FILE" ] || return 0
  grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2- || true
}

set_env() {
  if grep -qE "^$1=" "$ENV_FILE"; then
    sed -i "s|^$1=.*|$1=$2|" "$ENV_FILE"
  else
    printf '%s=%s\n' "$1" "$2" >> "$ENV_FILE"
  fi
}

# دامنه: آرگومان، وگرنه میزبانِ PUBLIC_URL.
DOMAIN="${1:-}"
if [ -z "$DOMAIN" ]; then
  url="$(env_value PUBLIC_URL)"
  DOMAIN="${url#*://}"
  DOMAIN="${DOMAIN%%/*}"
  DOMAIN="${DOMAIN%%:*}"
fi

# Let's Encrypt برای IP یا localhost گواهی نمی‌دهد؛ آنجا همان self-signed می‌ماند.
if [ -z "$DOMAIN" ] || [ "$DOMAIN" = "localhost" ] ||
  printf '%s' "$DOMAIN" | grep -qE '^[0-9.]+$'; then
  warn "دامنه‌ی عمومی تعریف نشده (PUBLIC_URL=$(env_value PUBLIC_URL)); گواهیِ Let's Encrypt رد شد."
  exit 0
fi

if [ ! -x "$ACME" ]; then
  warn "acme.sh در $ACME_HOME نیست؛ گواهیِ Let's Encrypt رد شد."
  warn "نصب: curl https://get.acme.sh | sh -s email=you@example.com"
  exit 0
fi

log "گواهیِ Let's Encrypt برای $DOMAIN"
mkdir -p "$CERT_DIR"

# گواهی‌های ECC در «‎<domain>_ecc‎» و RSA در «‎<domain>‎» نگه داشته می‌شوند.
if [ -f "$ACME_HOME/${DOMAIN}_ecc/${DOMAIN}.conf" ]; then
  ECC_FLAG="--ecc"
  CONF="$ACME_HOME/${DOMAIN}_ecc/${DOMAIN}.conf"
elif [ -f "$ACME_HOME/${DOMAIN}/${DOMAIN}.conf" ]; then
  ECC_FLAG=""
  CONF="$ACME_HOME/${DOMAIN}/${DOMAIN}.conf"
else
  ECC_FLAG=""
  CONF=""
fi

STOP_CMD="systemctl stop $SERVICE_NAME"
START_CMD="systemctl start $SERVICE_NAME"
RELOAD_CMD="systemctl restart $SERVICE_NAME"

if [ -z "$CONF" ]; then
  echo "گواهی‌ای برای این دامنه نیست؛ صدورِ تازه ($ACME_MODE)…"
  issue_flag="--alpn"
  [ "$ACME_MODE" = "standalone" ] && issue_flag="--standalone"
  # پس‌هوک حتی در شکستِ صدور هم اجرا می‌شود، پس سرویس پایین نمی‌ماند.
  "$ACME" --home "$ACME_HOME" --issue "$issue_flag" -d "$DOMAIN" \
    --keylength ec-256 \
    --pre-hook "$STOP_CMD" --post-hook "$START_CMD" ||
    fail "صدورِ گواهی ناموفق بود (دسترسیِ بیرونی به پورت ۴۴۳/۸۰ را بررسی کنید)."
  ECC_FLAG="--ecc"
  CONF="$ACME_HOME/${DOMAIN}_ecc/${DOMAIN}.conf"
else
  # هوک‌ها را در تنظیماتِ همین دامنه می‌نویسیم (همان قالبِ base64ِ خودِ acme).
  # گواهی‌هایی که بدونِ هوک صادر شده‌اند وگرنه در تمدیدِ خودکار شکست می‌خوردند،
  # چون برنامه پورتِ ۴۴۳ را نگه داشته و چالشِ ALPN جایی برای گوش دادن ندارد.
  set_conf() {
    local key="$1" value b64 line
    value="$2"
    b64="$(printf '%s' "$value" | base64 -w0)"
    line="$key='__ACME_BASE64__START_${b64}__ACME_BASE64__END_'"
    if grep -q "^$key=" "$CONF"; then
      sed -i "s|^$key=.*|$line|" "$CONF"
    else
      printf '%s\n' "$line" >> "$CONF"
    fi
  }
  if [ "$ACME_MODE" = "alpn" ]; then
    set_conf Le_PreHook "$STOP_CMD"
    set_conf Le_PostHook "$START_CMD"
    echo "هوک‌های تمدیدِ خودکار ثبت شد (stop/start سرویس)."
  fi

  # تمدید فقط اگر موعدش رسیده باشد؛ کدِ ۲ یعنی «هنوز لازم نیست».
  rc=0
  "$ACME" --home "$ACME_HOME" --renew -d "$DOMAIN" $ECC_FLAG || rc=$?
  case "$rc" in
    0) echo "گواهی تمدید شد." ;;
    2) echo "گواهی هنوز معتبر است؛ تمدید لازم نبود." ;;
    *) warn "تمدید ناموفق بود (کد $rc)؛ گواهیِ فعلی نصب می‌شود." ;;
  esac
fi

# نصب در مسیری که برنامه می‌خواند؛ دستورِ reload در تنظیماتِ acme ذخیره می‌شود
# تا تمدیدهای بعدیِ cron هم گواهیِ تازه را خودکار جایگزین و سرویس را ری‌استارت کنند.
"$ACME" --home "$ACME_HOME" --install-cert -d "$DOMAIN" $ECC_FLAG \
  --fullchain-file "$CERT_DIR/server.crt" \
  --key-file "$CERT_DIR/server.key" \
  --reloadcmd "$RELOAD_CMD"
chmod 600 "$CERT_DIR/server.key"

if [ -f "$ENV_FILE" ]; then
  set_env TLS_CERT "$CERT_DIR/server.crt"
  set_env TLS_KEY "$CERT_DIR/server.key"
fi

# بررسی: گواهیِ سروشده باید از Let's Encrypt باشد، نه self-signed.
HTTPS_PORT="$(env_value HTTPS_PORT)"
HTTPS_PORT="${HTTPS_PORT:-443}"
issuer=""
for _ in $(seq 1 15); do
  issuer="$(echo | openssl s_client -connect "127.0.0.1:$HTTPS_PORT" \
    -servername "$DOMAIN" 2>/dev/null |
    openssl x509 -noout -issuer 2>/dev/null || true)"
  [ -n "$issuer" ] && break
  sleep 2
done
case "$issuer" in
  *"Let's Encrypt"*)
    printf '\033[32mگواهیِ معتبر نصب شد: %s\033[0m\n' "$issuer"
    expiry="$(openssl x509 -noout -enddate -in "$CERT_DIR/server.crt" | cut -d= -f2)"
    echo "اعتبار تا: $expiry (تمدیدِ خودکار با cronِ acme.sh)"
    ;;
  *)
    warn "گواهیِ سروشده Let's Encrypt نیست: ${issuer:-نامعلوم}"
    ;;
esac
