#!/usr/bin/env bash
#
# منوی مدیریت SamaLine روی سرور — یک جا برای کارهای رایجِ گرداننده بدون نیاز
# به یادآوریِ دستورها: به‌روزرسانی، تغییر پورت و نشانی، گواهی TLS، سرویس، و
# مدیریت کاربر مدیر کل.
#
#   sudo bash scripts/manage.sh
#
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$APP_DIR/backend/.env"
SERVICE_NAME="${SERVICE_NAME:-samaline}"

c_cyan='\033[36m'; c_green='\033[32m'; c_red='\033[31m'; c_yellow='\033[33m'; c_off='\033[0m'
head() { printf "\n${c_cyan}==> %s${c_off}\n" "$1"; }
ok() { printf "${c_green}%s${c_off}\n" "$1"; }
warn() { printf "${c_yellow}%s${c_off}\n" "$1"; }
err() { printf "${c_red}%s${c_off}\n" "$1" >&2; }

[ "$(id -u)" -eq 0 ] || { err "باید با root اجرا شود:  sudo bash scripts/manage.sh"; exit 1; }
[ -f "$ENV_FILE" ] || warn "فایل تنظیمات ($ENV_FILE) هنوز نیست؛ ابتدا یک‌بار deploy.sh را اجرا کنید."

# خواندن یک کلید از .env (یا خالی).
env_value() {
  [ -f "$ENV_FILE" ] || return 0
  grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2- || true
}

# افزودن یا جایگزینی یک کلید در .env. جداکننده‌ی sed را | می‌گذاریم چون مقدار
# ممکن است / داشته باشد (مسیر گواهی، نشانی).
set_env() {
  if grep -qE "^$1=" "$ENV_FILE"; then
    sed -i "s|^$1=.*|$1=$2|" "$ENV_FILE"
  else
    printf '%s=%s\n' "$1" "$2" >> "$ENV_FILE"
  fi
}

# باز کردن یک پورت در فایروال (ufw یا firewalld)، اگر فعال باشد.
open_firewall() {
  local port="$1"
  if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
    ufw allow "$port/tcp" >/dev/null 2>&1 || true
  elif command -v firewall-cmd >/dev/null 2>&1 && firewall-cmd --state >/dev/null 2>&1; then
    firewall-cmd --permanent --add-port="$port/tcp" >/dev/null 2>&1 || true
    firewall-cmd --reload >/dev/null 2>&1 || true
  fi
}

pause() { read -rp "برای ادامه Enter بزنید… " _; }

# سرویس را دوباره راه‌اندازی می‌کند و سلامت را چک می‌کند.
restart_and_check() {
  systemctl restart "$SERVICE_NAME"
  local port https_port cert url scheme host
  port="$(env_value PORT)"; port="${port:-8080}"
  https_port="$(env_value HTTPS_PORT)"; https_port="${https_port:-443}"
  cert="$(env_value TLS_CERT)"
  if [ -n "$cert" ]; then
    url="https://127.0.0.1:$https_port/api/v1/health"; scheme="-k"
  else
    url="http://127.0.0.1:$port/api/v1/health"; scheme=""
  fi
  printf "در حال بررسی سلامت"
  for _ in $(seq 1 20); do
    if curl -fsS $scheme -o /dev/null "$url" 2>/dev/null; then
      printf "\n"; ok "سرویس سالم بالا آمد."
      return 0
    fi
    printf "."; sleep 1
  done
  printf "\n"; err "سرویس در زمان انتظار پاسخ سلامت نداد؛ لاگ را ببینید (گزینه ۵)."
  return 1
}

show_status() {
  head "وضعیت سرویس"
  systemctl is-active "$SERVICE_NAME" >/dev/null 2>&1 && ok "فعال" || err "غیرفعال"
  echo "نسخه:        $(node -e "try{console.log(require('$APP_DIR/backend/package.json').version)}catch(e){console.log('?')}" 2>/dev/null || echo '?')"
  echo "پورت HTTP:   $(env_value PORT)"
  echo "پورت HTTPS:  $(env_value HTTPS_PORT)  (TLS: $([ -n "$(env_value TLS_CERT)" ] && echo روشن || echo خاموش))"
  echo "نشانی عمومی: $(env_value PUBLIC_URL)"
  head "پورت‌های در حال گوش‌دادن"
  ss -ltnp 2>/dev/null | grep -E "node|:$(env_value PORT) |:$(env_value HTTPS_PORT) " || echo "—"
}

do_update() {
  head "به‌روزرسانی برنامه از گیت"
  warn "داده، کلیدها و پورت دست نمی‌خورند. پیش از تغییر اسکیما، پشتیبان خودکار گرفته می‌شود."
  read -rp "ادامه؟ (y/N) " a
  [ "$a" = "y" ] || { echo "لغو شد."; return; }
  if git -C "$APP_DIR" pull --ff-only; then
    exec bash "$APP_DIR/scripts/deploy.sh"
  else
    err "git pull نشد (شاید سرور به گیت‌هاب دسترسی ندارد یا تغییر دستی روی سرور هست)."
    echo "راه دیگر: نسخه‌ی تازه را با git bundle از دستگاه خودتان بیاورید و سپس:"
    echo "  sudo bash $APP_DIR/scripts/deploy.sh"
  fi
}

do_ports() {
  head "تغییر پورت‌های اجرا"
  echo "پورت فعلی HTTP: $(env_value PORT) — HTTPS: $(env_value HTTPS_PORT)"
  read -rp "پورت HTTP تازه (خالی = بدون تغییر): " newp
  read -rp "پورت HTTPS تازه (خالی = بدون تغییر): " newhttps
  if [ -z "$newp" ] && [ -z "$newhttps" ]; then echo "تغییری داده نشد."; return; fi
  if [ -n "$newp" ]; then
    case "$newp" in (*[!0-9]*|'') err "پورت نامعتبر."; return;; esac
    set_env PORT "$newp"; open_firewall "$newp"; ok "PORT = $newp"
  fi
  if [ -n "$newhttps" ]; then
    case "$newhttps" in (*[!0-9]*|'') err "پورت نامعتبر."; return;; esac
    set_env HTTPS_PORT "$newhttps"; open_firewall "$newhttps"; ok "HTTPS_PORT = $newhttps"
  fi
  warn "توجه: اگر نشانی عمومی باید پورت تازه را نشان دهد، از گزینه‌ی «نشانی شبکه» هم به‌روزش کنید."
  restart_and_check || true
}

do_network() {
  head "تنظیمات شبکه / نشانی عمومی"
  echo "نشانی فعلی: $(env_value PUBLIC_URL)"
  echo "این نشانی در لینک‌های پیامک، ایمیل و یادآوری استفاده می‌شود."
  read -rp "نشانی عمومی تازه (مثل https://survey.example.com یا https://192.168.1.155): " url
  [ -z "$url" ] && { echo "تغییری داده نشد."; return; }
  case "$url" in
    http://*|https://*) ;;
    *) err "باید با http:// یا https:// شروع شود."; return;;
  esac
  url="${url%/}"
  set_env PUBLIC_URL "$url"
  set_env PUBLIC_FORM_BASE_URL "$url/f"
  ok "نشانی عمومی = $url"
  restart_and_check || true
}

do_tls() {
  head "گواهی TLS"
  local cert; cert="$(env_value TLS_CERT)"
  echo "وضعیت فعلی: $([ -n "$cert" ] && echo "روشن ($cert)" || echo خاموش)"
  echo "۱) ساخت دوباره‌ی گواهی self-signed"
  echo "۲) معرفی گواهی واقعی (مسیر فایل‌های خودتان)"
  echo "۳) خاموش‌کردن TLS (فقط HTTP)"
  echo "۰) بازگشت"
  read -rp "انتخاب: " t
  case "$t" in
    1)
      local dir ip; dir="$APP_DIR/backend/certs"
      ip="${SERVER_ADDR:-$(hostname -I | awk '{print $1}')}"; [ -n "$ip" ] || ip="127.0.0.1"
      mkdir -p "$dir"
      openssl req -x509 -newkey rsa:2048 -nodes -days 3650 \
        -keyout "$dir/server.key" -out "$dir/server.crt" \
        -subj "/CN=$ip" -addext "subjectAltName=IP:$ip" >/dev/null 2>&1
      chmod 600 "$dir/server.key"
      set_env TLS_CERT "$dir/server.crt"; set_env TLS_KEY "$dir/server.key"
      ok "گواهی self-signed تازه ساخته شد (SAN=IP:$ip)."
      restart_and_check || true
      ;;
    2)
      read -rp "مسیر فایل گواهی (crt/pem): " cpath
      read -rp "مسیر فایل کلید خصوصی (key): " kpath
      [ -f "$cpath" ] && [ -f "$kpath" ] || { err "فایل‌ها پیدا نشد."; return; }
      set_env TLS_CERT "$cpath"; set_env TLS_KEY "$kpath"
      ok "گواهی واقعی معرفی شد."
      restart_and_check || true
      ;;
    3)
      set_env TLS_CERT ""; set_env TLS_KEY ""
      ok "TLS خاموش شد؛ فقط HTTP روی پورت $(env_value PORT)."
      restart_and_check || true
      ;;
    *) ;;
  esac
}

do_superadmin() {
  head "مدیر کل سامانه (سوپرادمین)"
  echo "۱) فهرست مدیران کل"
  echo "۲) افزودن مدیر کل (با ایمیل)"
  echo "۳) حذف مدیر کل (با ایمیل)"
  echo "۰) بازگشت"
  read -rp "انتخاب: " s
  case "$s" in
    1) npm --prefix "$APP_DIR/backend" run --silent superadmin -- --list || true;;
    2) read -rp "ایمیل: " e; [ -n "$e" ] && npm --prefix "$APP_DIR/backend" run --silent superadmin -- "$e" || true;;
    3) read -rp "ایمیل: " e; [ -n "$e" ] && npm --prefix "$APP_DIR/backend" run --silent superadmin -- "$e" --revoke || true;;
    *) ;;
  esac
}

do_user() {
  head "مدیریت کاربر پنل"
  echo "۱) بازنشانی رمز کاربر (رمز موقت چاپ می‌شود)"
  echo "۲) خاموش‌کردن ورود دومرحله‌ای (۲FA) کاربر"
  echo "۳) فهرست کاربران دارای ۲FA"
  echo "۰) بازگشت"
  read -rp "انتخاب: " u
  case "$u" in
    1) read -rp "ایمیل: " e; [ -n "$e" ] && npm --prefix "$APP_DIR/backend" run --silent reset-password -- "$e" || true;;
    2) read -rp "ایمیل: " e; [ -n "$e" ] && npm --prefix "$APP_DIR/backend" run --silent reset-2fa -- "$e" || true;;
    3) npm --prefix "$APP_DIR/backend" run --silent reset-2fa -- --list || true;;
    *) ;;
  esac
}

do_ai() {
  head "هوش مصنوعی"
  npm --prefix "$APP_DIR/backend" run --silent set-ai -- --show 2>/dev/null || true
  echo
  echo "۱) مدل محلی Ollama (پیشنهاد: qwen2.5:1.5b)"
  echo "۲) API آنلاین سازگار با OpenAI (با کلید)"
  echo "۳) خاموش‌کردن هوش مصنوعی (حالت نمونه)"
  echo "۰) بازگشت"
  read -rp "انتخاب: " x
  case "$x" in
    1)
      local base model
      read -rp "نشانی Ollama [http://127.0.0.1:11434/v1]: " base
      base="${base:-http://127.0.0.1:11434/v1}"
      read -rp "نام مدل [qwen2.5:1.5b]: " model
      model="${model:-qwen2.5:1.5b}"
      npm --prefix "$APP_DIR/backend" run --silent set-ai -- \
        --provider openai --base-url "$base" --model "$model" --key - || true
      ok "مدل محلی تنظیم شد. (تغییر بدون ری‌استارت اثر می‌کند)"
      ;;
    2)
      local base model key
      read -rp "نشانی پایه [https://api.openai.com/v1]: " base
      base="${base:-https://api.openai.com/v1}"
      read -rp "نام مدل [gpt-4o-mini]: " model
      model="${model:-gpt-4o-mini}"
      read -rp "کلید API: " key
      npm --prefix "$APP_DIR/backend" run --silent set-ai -- \
        --provider openai --base-url "$base" --model "$model" ${key:+--key "$key"} || true
      ok "سرویس آنلاین تنظیم شد."
      ;;
    3)
      npm --prefix "$APP_DIR/backend" run --silent set-ai -- --off || true
      ;;
    *) ;;
  esac
}

menu() {
  cat <<'MENU'

====== مدیریت SamaLine ======
  1) وضعیت سرویس و پورت‌ها
  2) ری‌استارت سرویس
  3) روشن کردن سرویس
  4) خاموش کردن سرویس
  5) نمایش لاگ زنده (Ctrl+C برای خروج)
  6) به‌روزرسانی برنامه (گیت + استقرار دوباره)
  7) تغییر پورت‌های اجرا (HTTP/HTTPS)
  8) تنظیمات شبکه / نشانی عمومی
  9) گواهی TLS (ساخت دوباره / واقعی / خاموش)
 10) مدیر کل (افزودن/حذف/فهرست)
 11) مدیریت کاربر (بازنشانی رمز / خاموش‌کردن ۲FA)
  0) خروج
MENU
  read -rp "انتخاب شما: " choice
  case "$choice" in
    1) show_status;;
    2) systemctl restart "$SERVICE_NAME" && restart_and_check || true;;
    3) systemctl start "$SERVICE_NAME" && ok "روشن شد.";;
    4) read -rp "خاموش‌کردن سرویس؟ پنل و فرم‌ها از دسترس خارج می‌شوند. (y/N) " a
       [ "$a" = "y" ] && systemctl stop "$SERVICE_NAME" && warn "خاموش شد." || echo "لغو شد.";;
    5) journalctl -u "$SERVICE_NAME" -f;;
    6) do_update;;
    7) do_ports;;
    8) do_network;;
    9) do_tls;;
    10) do_superadmin;;
    11) do_user;;
    0) exit 0;;
    *) err "گزینه‌ی نامعتبر.";;
  esac
}

while true; do
  menu
  pause
done
