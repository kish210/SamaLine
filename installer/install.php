<?php
/**
 * نصاب هوشمند SamaLine برای cPanel و هاست اشتراکی.
 *
 * SamaLine یک اپ Node است، نه PHP. این فایل خودش سامانه را اجرا نمی‌کند؛
 * کارش این است که محیط را بشناسد، Node را پیدا کند، وابستگی‌ها را نصب و
 * build کند، تنظیمات را بسازد و سرویس را بالا بیاورد — همه از داخل مرورگر
 * و بدون نیاز به SSH.
 *
 * روش کار: نصب واقعی در پس‌زمینه اجرا می‌شود و این صفحه فقط لاگش را نشان
 * می‌دهد. دلیلش این است که npm install و build چند دقیقه طول می‌کشد و
 * محدودیت max_execution_time در هاست اشتراکی وسط کار نصب را می‌کشد.
 *
 * استفاده: این پوشه را کنار پوشه‌های backend/panel/form-renderer بگذارید و
 * در مرورگر باز کنید: https://example.com/installer/install.php
 */

declare(strict_types=1);

// ── مسیرها ────────────────────────────────────────────────────────────
/** ریشه‌ی پروژه: یک پوشه بالاتر از نصاب. */
const APP_ROOT = __DIR__ . '/..';
/** فایل قفل؛ وجودش یعنی نصب یک بار انجام شده است. */
const LOCK_FILE = __DIR__ . '/.installed';
/** لاگ زنده‌ی نصب. */
const LOG_FILE = __DIR__ . '/install.log';
/** فایل وضعیت نصب پس‌زمینه. */
const STATE_FILE = __DIR__ . '/install.state';

const MIN_NODE_MAJOR = 20;
const MIN_PHP = '7.4';

// ── ابزارهای پایه ─────────────────────────────────────────────────────

/** آیا اجرای دستور بیرونی مجاز است؟ روی بعضی هاست‌ها بسته است. */
function exec_allowed(): bool
{
    if (!function_exists('proc_open') && !function_exists('shell_exec')) {
        return false;
    }
    $disabled = array_map('trim', explode(',', (string) ini_get('disable_functions')));
    foreach (['proc_open', 'shell_exec', 'exec'] as $fn) {
        if (!in_array($fn, $disabled, true) && function_exists($fn)) {
            return true;
        }
    }
    return false;
}

/** اجرای یک دستور و گرفتن خروجی؛ null یعنی اجرا ممکن نبود. */
function run(string $command): ?string
{
    if (!exec_allowed()) {
        return null;
    }
    $output = @shell_exec($command . ' 2>&1');
    return $output === null ? null : trim($output);
}

/**
 * آیا PHP با open_basedir محدود شده؟
 *
 * روی cPanel این تقریبا همیشه روشن است و PHP را به پوشه‌ی خانگی محدود
 * می‌کند. اهمیتش اینجاست که `is_file()` و `glob()` برای مسیرهایی مثل
 * `/opt/cpanel/...` بی‌صدا false می‌دهند — حتی وقتی همان مسیر از پوسته
 * کاملا قابل دیدن و اجراست.
 */
function open_basedir_limited(): bool
{
    return trim((string) ini_get('open_basedir')) !== '';
}

/**
 * پیدا کردن مفسر Node.
 *
 * همه‌ی جست‌وجو از راه پوسته انجام می‌شود، نه توابع فایل PHP.
 *
 * دلیلش open_basedir است: روی cPanel، PHP معمولا فقط پوشه‌ی خانگی را
 * می‌بیند، پس `is_file('/opt/cpanel/ea-nodejs20/bin/node')` مقدار false
 * برمی‌گرداند در حالی که همان فایل هست و اجرا هم می‌شود. نسخه‌ی قبلی
 * دقیقا به همین دلیل روی هاست واقعی «Node پیدا نشد» می‌داد.
 */
function find_node(): ?array
{
    /*
     * مسیر دستی، بالاترین اولویت و بدون هیچ حدس دیگری.
     *
     * کاربری که مسیر را می‌داند نباید با انتخاب خودکار ما بجنگد.
     */
    $manual = $_POST['nodePath'] ?? $_GET['nodePath'] ?? getenv('SAMALINE_NODE');
    if (is_string($manual) && trim($manual) !== '') {
        return probe_node(trim($manual));
    }

    $home = getenv('HOME') ?: '~';
    $patterns = [
        '/opt/cpanel/ea-nodejs*/bin/node',
        '/opt/alt/alt-nodejs*/root/usr/bin/node',
        $home . '/nodevenv/*/*/bin/node',
        $home . '/.nvm/versions/node/*/bin/node',
        '/opt/nodejs*/bin/node',
        '/usr/local/lib/nodejs/*/bin/node',
        '/usr/local/bin/node',
        '/usr/bin/node',
    ];

    $candidates = [];
    $which = run('command -v node');
    if ($which) {
        $candidates[] = $which;
    }

    /*
     * `ls` به‌جای `glob()`.
     *
     * الگوها عمدا بدون escapeshellarg می‌آیند چون باید توسط پوسته باز
     * شوند؛ محتوایشان ثابت و از کد خودمان است، نه ورودی کاربر.
     */
    $listing = run('ls -d ' . implode(' ', $patterns) . ' 2>/dev/null');
    foreach (preg_split('/\r?\n/', (string) $listing) ?: [] as $line) {
        $line = trim($line);
        if ($line !== '') {
            $candidates[] = $line;
        }
    }

    $best = null;
    foreach (array_unique($candidates) as $path) {
        $found = probe_node($path);
        // بالاترین نسخه‌ی موجود انتخاب می‌شود، نه اولین.
        if ($found && ($best === null || $found['major'] > $best['major'])) {
            $best = $found;
        }
    }

    return $best;
}

/** آزمودن یک مسیر با اجرای واقعی `node -v`؛ تنها سنجه‌ی قابل اعتماد. */
function probe_node(string $path): ?array
{
    $version = run(escapeshellarg($path) . ' -v');
    if (!$version || !preg_match('/^v(\d+)\./', $version, $m)) {
        return null;
    }
    return [
        'path' => $path,
        'version' => trim($version),
        'major' => (int) $m[1],
    ];
}

/**
 * npm کنار همان Node انتخاب‌شده.
 *
 * وجود فایل با پوسته سنجیده می‌شود نه `is_file()`، به همان دلیل
 * open_basedir که در `find_node()` توضیح داده شد.
 */
function find_npm(?array $node): ?string
{
    if ($node) {
        $sibling = dirname($node['path']) . '/npm';
        if (run('test -f ' . escapeshellarg($sibling) . ' && echo yes')) {
            return $sibling;
        }
        // نصب‌های تازه‌ی Node گاهی فقط npm-cli.js دارند.
        $cli = dirname($node['path']) . '/../lib/node_modules/npm/bin/npm-cli.js';
        if (run('test -f ' . escapeshellarg($cli) . ' && echo yes')) {
            return $node['path'] . ' ' . $cli;
        }
    }
    $which = run('command -v npm');
    return $which ?: null;
}

/**
 * فضای آزاد دیسک بر حسب مگابایت.
 *
 * روی هاست اشتراکی با سهمیه (quota)، `disk_free_space` معمولا صفر یا
 * false می‌دهد. صفر را «نامشخص» می‌شماریم نه «هیچ فضایی نیست»: نمایش
 * «۰ مگابایت آزاد» کاربر را الکی می‌ترساند در حالی که چیزی معلوم نشده.
 */
function free_mb(): ?int
{
    $bytes = @disk_free_space(APP_ROOT);
    if ($bytes === false || $bytes <= 0) {
        // تلاش دوم از راه پوسته، که محدودیت open_basedir ندارد.
        $df = run('df -Pm ' . escapeshellarg(APP_ROOT) . " | awk 'NR==2{print \$4}'");
        return is_string($df) && preg_match('/^\d+$/', trim($df))
            ? (int) trim($df)
            : null;
    }
    return (int) round($bytes / 1048576);
}

function is_installed(): bool
{
    return is_file(LOCK_FILE);
}

/** پاسخ JSON و پایان. */
function json_out(array $data): void
{
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// ── بررسی محیط ────────────────────────────────────────────────────────

/**
 * فهرست بررسی‌ها.
 *
 * هر مورد `fatal` یعنی بدون آن نصب اصلا ممکن نیست؛ بقیه هشدارند.
 */
function checks(): array
{
    $node = find_node();
    $npm = find_npm($node);
    $free = free_mb();
    $writable = is_writable(APP_ROOT) && is_writable(__DIR__);

    $items = [];

    $items[] = [
        'key' => 'php',
        'title' => 'نسخه PHP',
        'ok' => version_compare(PHP_VERSION, MIN_PHP, '>='),
        'fatal' => true,
        'value' => PHP_VERSION,
        'help' => 'حداقل PHP ' . MIN_PHP . ' لازم است.',
    ];

    $items[] = [
        'key' => 'exec',
        'title' => 'اجرای دستور (shell_exec)',
        'ok' => exec_allowed(),
        'fatal' => true,
        'value' => exec_allowed() ? 'مجاز' : 'مسدود',
        'help' => 'بدون این، نصاب نمی‌تواند npm را اجرا کند. از پشتیبانی هاست بخواهید'
            . ' shell_exec یا proc_open را برای این حساب باز کنند.',
    ];

    $items[] = [
        'key' => 'node',
        'title' => 'Node.js',
        'ok' => $node !== null && $node['major'] >= MIN_NODE_MAJOR,
        'fatal' => true,
        'value' => $node
            ? $node['version'] . ' (' . $node['path'] . ')'
            : 'پیدا نشد',
        /*
         * وقتی چیزی پیدا نشد، فهرست پوشه‌ی nodevenv هم نشان داده می‌شود.
         *
         * تفاوت «هنوز اپ Node نساخته‌اید» با «ساخته‌اید ولی جای دیگری
         * است» را فقط همین فهرست روشن می‌کند؛ بدون آن کاربر نمی‌داند کدام
         * یک از دو کار را باید بکند.
         */
        'help' => $node
            ? 'همین مفسر برای نصب استفاده می‌شود.'
            : 'در cPanel از بخش «Setup Node.js App» یک اپ با نسخه‌ی '
                . MIN_NODE_MAJOR . ' یا بالاتر بسازید، بعد این صفحه را دوباره'
                . ' باز کنید. اپ‌های Node موجود روی این حساب: '
                . (run('ls -1 ' . escapeshellarg((getenv('HOME') ?: '~') . '/nodevenv')
                    . ' 2>/dev/null | tr "\n" " "') ?: 'هیچ‌کدام')
                . ' — اگر مسیر مفسر را می‌دانید، در کادر پایین بگذارید.',
    ];

    $items[] = [
        'key' => 'npm',
        'title' => 'npm',
        'ok' => $npm !== null,
        'fatal' => true,
        'value' => $npm ?: 'پیدا نشد',
        'help' => 'npm معمولا کنار Node نصب است.',
    ];

    $items[] = [
        'key' => 'writable',
        'title' => 'دسترسی نوشتن',
        'ok' => $writable,
        'fatal' => true,
        'value' => $writable ? 'دارد' : 'ندارد',
        'help' => 'پوشه‌ی پروژه و پوشه‌ی نصاب باید قابل نوشتن باشند.',
    ];

    $items[] = [
        'key' => 'files',
        'title' => 'فایل‌های پروژه',
        'ok' => is_dir(APP_ROOT . '/backend') && is_dir(APP_ROOT . '/panel'),
        'fatal' => true,
        'value' => is_dir(APP_ROOT . '/backend') ? 'کامل' : 'ناقص',
        'help' => 'پوشه‌های backend، panel و form-renderer باید کنار پوشه‌ی installer باشند.',
    ];

    $items[] = [
        'key' => 'disk',
        'title' => 'فضای دیسک',
        'ok' => $free === null || $free >= 900,
        'fatal' => false,
        'value' => $free === null ? 'نامشخص' : $free . ' مگابایت آزاد',
        'help' => 'نصب وابستگی‌ها حدود ۸۰۰ مگابایت فضای موقت می‌خواهد.',
    ];

    /*
     * نبود کامپایلر معمولا مشکلی نیست چون better-sqlite3 برای نسخه‌های
     * رایج Node فایل ازپیش‌ساخته دارد و npm همان را دانلود می‌کند.
     *
     * متن قبلی می‌گفت «نصاب خودکار به نسخه‌ی بدون کامپایل سوییچ می‌کند» —
     * که درست نبود؛ چنین منطقی وجود نداشت و اگر ساخت شکست می‌خورد، کاربر
     * دنبال قابلیتی می‌گشت که هیچ‌وقت نوشته نشده بود.
     */
    $cc = run('command -v cc') ?: run('command -v gcc');
    $items[] = [
        'key' => 'compiler',
        'title' => 'کامپایلر (برای پایگاه‌داده)',
        'ok' => (bool) $cc,
        'fatal' => false,
        'value' => $cc ?: 'پیدا نشد',
        'help' => 'معمولا لازم نیست: نسخه‌ی ازپیش‌ساخته‌ی پایگاه‌داده دانلود'
            . ' می‌شود. فقط اگر برای نسخه‌ی Node این هاست فایل آماده نبود،'
            . ' نصب در همین مرحله شکست می‌خورد و باید از پشتیبانی هاست'
            . ' کامپایلر بخواهید.',
    ];

    /*
     * open_basedir خودش مانع نصب نیست، ولی توضیح‌دهنده‌ی خیلی از
     * «پیدا نشد»هاست؛ نمایشش باعث می‌شود کاربر دنبال مقصر اشتباه نگردد.
     */
    $items[] = [
        'key' => 'open_basedir',
        'title' => 'محدودیت open_basedir',
        'ok' => true,
        'fatal' => false,
        'value' => open_basedir_limited() ? (string) ini_get('open_basedir') : 'ندارد',
        'help' => open_basedir_limited()
            ? 'PHP فقط این مسیرها را می‌بیند. جست‌وجوی Node از راه پوسته انجام'
                . ' می‌شود، پس این محدودیت مانع نصب نیست.'
            : 'محدودیتی روی مسیرهای PHP نیست.',
    ];

    /*
     * همان تابعی که تصمیمِ نحوه‌ی اجرا را می‌گیرد اینجا هم استفاده می‌شود.
     *
     * اگر این نمایش با آن تصمیم فرق کند، کاربر روی صفحه «Passenger: نیست»
     * می‌بیند ولی نصاب مسیر Passenger را می‌رود — و بعد دنبال سرویسی
     * می‌گردد که هیچ‌وقت اجرا نشده.
     */
    $passenger = has_passenger();
    $items[] = [
        'key' => 'passenger',
        'title' => 'Passenger (اجرای دائمی)',
        'ok' => $passenger,
        'fatal' => false,
        'value' => $passenger ? 'هست' : 'نیست',
        'help' => $passenger
            ? 'اجرای سامانه با خودِ cPanel است؛ پس از نصب، فایل شروع را روی '
                . 'app.js بگذارید و Restart بزنید.'
            : 'بدون Passenger، سامانه روی یک پورت جدا اجرا می‌شود.',
    ];

    return [
        'items' => $items,
        'node' => $node,
        'npm' => $npm,
        'canInstall' => !array_filter(
            $items,
            static fn(array $i): bool => $i['fatal'] && !$i['ok'],
        ),
    ];
}

// ── اجرای نصب ─────────────────────────────────────────────────────────

/**
 * آیا این هاست Passenger دارد؟
 *
 * روی cPanel، «Setup Node.js App» با Passenger کار می‌کند و خودش پروسه را
 * می‌گرداند. وجود `passenger-config` یا پوشه‌ی `nodevenv` نشانه‌ی همین است.
 */
function has_passenger(): bool
{
    if (run('command -v passenger-config')) {
        return true;
    }
    $home = getenv('HOME') ?: '';
    return $home !== '' && is_dir($home . '/nodevenv');
}

/** رشته‌ی تصادفی امن برای کلیدها. */
function random_key(int $bytes): string
{
    return bin2hex(random_bytes($bytes));
}

/**
 * جایگزینی یک کلید در فایل .env، یا افزودنش اگر نبود.
 *
 * `preg_replace` به‌تنهایی کافی نیست: اگر کلید در فایل نباشد بی‌صدا هیچ
 * کاری نمی‌کند و مقدار هرگز نوشته نمی‌شود. همین باعث شده بود `PUBLIC_URL`
 * در نصب‌های بعدی ننشیند و وبهوک ربات تلگرام بی‌صدا ثبت نشود.
 */
function set_env_line(string $env, string $key, string $value): string
{
    $pattern = '/^' . preg_quote($key, '/') . '=.*$/m';
    $line = $key . '=' . $value;

    if (preg_match($pattern, $env)) {
        return (string) preg_replace($pattern, $line, $env);
    }
    return rtrim($env, "\n") . "\n" . $line . "\n";
}

/**
 * ساخت اسکریپت نصب و اجرای آن در پس‌زمینه.
 *
 * PHP فقط اسکریپت را می‌نویسد و رها می‌کند؛ خودِ نصب مستقل از این درخواست
 * ادامه پیدا می‌کند، پس بستن مرورگر یا تایم‌اوت PHP آن را نمی‌کشد.
 */
function start_install(array $config): array
{
    $node = find_node();
    $npm = find_npm($node);
    if (!$node || !$npm) {
        return ['ok' => false, 'error' => 'Node یا npm پیدا نشد.'];
    }

    $root = realpath(APP_ROOT);
    $port = (int) $config['port'];
    $publicUrl = rtrim((string) $config['publicUrl'], '/');
    $nodeBin = $node['path'];
    $nodeDir = dirname($nodeBin);

    // فایل تنظیمات؛ کلیدها یک بار ساخته می‌شوند و بعد دست‌نخورده می‌مانند.
    $envPath = $root . '/backend/.env';
    if (!is_file($envPath)) {
        $env = "NODE_ENV=production\n"
            . "PORT={$port}\n"
            . "DB_DRIVER=sqlite\n"
            . "SQLITE_PATH=data/samaline.sqlite\n"
            . "UPLOAD_DIR=data/uploads\n"
            . "PUBLIC_URL={$publicUrl}\n"
            . "PUBLIC_FORM_BASE_URL={$publicUrl}/f\n"
            . 'JWT_SECRET=' . random_key(32) . "\n"
            . 'RESPONDENT_KEY_SALT=' . random_key(16) . "\n"
            // نام درست کلیدی که برنامه می‌خواند؛ پیش از این SECRET_BOX_KEY
            // نوشته می‌شد که هرگز خوانده نمی‌شد.
            . 'SECRET_ENCRYPTION_KEY=' . random_key(32) . "\n"
            /*
             * پیامک برای «یادآوری فرم نیمه‌تمام» و تایید شماره لازم است.
             * خاموش گذاشته می‌شود تا نصب بدون درگاه پیامک هم کار کند؛ برای
             * روشن کردن، مقدار SMS_PROVIDER را kavenegar کنید و کلید را
             * بگذارید. بدون این‌ها یادآوری بی‌صدا رد می‌شود، نه اینکه خطا بدهد.
             */
            . "# SMS_PROVIDER=kavenegar\n"
            . "# KAVENEGAR_API_KEY=\n"
            . "# KAVENEGAR_SENDER=\n";
        file_put_contents($envPath, $env);
        @chmod($envPath, 0600);
    } else {
        // فقط پورت و نشانی عمومی به‌روز می‌شوند؛ عوض کردن کلیدها یعنی همه‌ی
        // توکن‌های صادرشده و داده‌ی رمزشده از کار می‌افتد.
        $env = (string) file_get_contents($envPath);
        $env = set_env_line($env, 'PORT', (string) $port);
        if ($publicUrl !== '') {
            $env = set_env_line($env, 'PUBLIC_URL', $publicUrl);
            $env = set_env_line($env, 'PUBLIC_FORM_BASE_URL', $publicUrl . '/f');
        }
        file_put_contents($envPath, $env);
    }

    /*
     * نقطه‌ی ورود Passenger.
     *
     * cPanel اپ Node را از ریشه‌ی برنامه اجرا می‌کند، ولی مسیر پایگاه‌داده و
     * پوشه‌ی آپلود نسبت به پوشه‌ی کاری حساب می‌شوند (`data/samaline.sqlite`).
     * بدون این فایل، Passenger پایگاه‌داده را در ریشه می‌سازد و اجرای دستی
     * در `backend/` — یعنی دو پایگاه‌داده‌ی جدا، و کاربر با یک سامانه‌ی
     * خالی روبه‌رو می‌شود در حالی که داده‌اش جای دیگری سالم است.
     *
     * این فایل در مخزن هم هست تا بشود پیش از نصب در cPanel انتخابش کرد؛
     * اینجا دوباره نوشته می‌شود تا نصب روی نسخه‌های قدیمی‌تر هم درستش کند.
     */
    $entry = <<<JS
// این فایل را نصاب ساخته است. «Application startup file» در cPanel باید
// همین باشد، نه backend/dist/main.js.
process.chdir(__dirname + '/backend');
require('./backend/dist/main.js');
JS;
    file_put_contents($root . '/app.js', $entry);

    /*
     * روی هاست Passenger‌دار، خودِ Passenger برنامه را اجرا می‌کند.
     *
     * راه انداختن یک پروسه‌ی جدا با nohup کنار آن، دو مشکل دارد: هر دو
     * سر یک پورت دعوا می‌کنند، و روی هاست اشتراکی پروسه‌های پس‌زمینه‌ی
     * بی‌صاحب به‌هرحال کشته می‌شوند. پس فقط ساخته می‌شود و کاربر در cPanel
     * دکمه‌ی Restart را می‌زند.
     */
    $runSection = has_passenger()
        ? <<<SH
echo "Passenger روی این هاست هست؛ اجرای سامانه با خودِ cPanel است."
echo "در «Setup Node.js App» فایل شروع را روی app.js بگذارید و Restart بزنید."
echo "done" > "{$root}/installer/install.state"
exit 0
SH
        : <<<SH
# فقط پروسه‌ی همین نصب کشته می‌شود، نه هر Node دیگری از همین کاربر.
pkill -f "{$root}/backend/dist/main" 2>/dev/null || true
sleep 1
cd "{$root}/backend"
nohup "{$nodeBin}" dist/main > "{$root}/installer/runtime.log" 2>&1 &
sleep 6

step "بررسی سلامت"
for i in \$(seq 1 20); do
  if curl -fsS -o /dev/null "http://127.0.0.1:{$port}/api/docs" 2>/dev/null; then
    echo "سامانه بالا آمد."
    echo "done" > "{$root}/installer/install.state"
    exit 0
  fi
  sleep 2
done

tail -30 "{$root}/installer/runtime.log" 2>/dev/null
fail "سامانه بالا نیامد"
SH;

    // نشانی API نسبی است تا فرقی نکند سامانه روی کدام دامنه بالا می‌آید.
    $script = <<<SH
#!/bin/bash
set -uo pipefail
export PATH="{$nodeDir}:\$PATH"
# روی هاست اشتراکی حافظه کم است و build فرم و پنل بدون سقف صریح با
# «JavaScript heap out of memory» می‌افتد — بی‌آنکه علتش روشن باشد.
export NODE_OPTIONS="\${NODE_OPTIONS:---max-old-space-size=512}"
cd "{$root}"

step() { printf '\\n=== %s\\n' "\$1"; }
fail() { printf '\\nخطا: %s\\n' "\$1"; echo "failed" > "{$root}/installer/install.state"; exit 1; }

echo "running" > "{$root}/installer/install.state"

step "نصب وابستگی‌های بک‌اند"
npm --prefix backend install --no-audit --no-fund || fail "نصب وابستگی بک‌اند"

step "نصب وابستگی‌های فرم"
npm --prefix form-renderer install --no-audit --no-fund || fail "نصب وابستگی فرم"

step "نصب وابستگی‌های پنل"
npm --prefix panel install --no-audit --no-fund || fail "نصب وابستگی پنل"

step "ساخت فرم"
VITE_API_URL="/api/v1" npm --prefix form-renderer run build || fail "ساخت فرم"

step "ساخت پنل"
VITE_API_URL="/api/v1" npm --prefix panel run build || fail "ساخت پنل"

step "ساخت بک‌اند"
npm --prefix backend run build || fail "ساخت بک‌اند"

step "پاک‌سازی وابستگی‌های توسعه"
npm --prefix backend prune --omit=dev >/dev/null 2>&1 || true
rm -rf form-renderer/node_modules panel/node_modules

step "آماده‌سازی اجرا"
{$runSection}
SH;

    $scriptPath = __DIR__ . '/run-install.sh';
    file_put_contents($scriptPath, $script);
    @chmod($scriptPath, 0700);

    @unlink(LOG_FILE);
    file_put_contents(STATE_FILE, 'starting');

    // setsid تا پروسه به این درخواست PHP وابسته نماند.
    $command = sprintf(
        'setsid nohup bash %s > %s 2>&1 < /dev/null & echo $!',
        escapeshellarg($scriptPath),
        escapeshellarg(LOG_FILE),
    );
    $pid = run($command);

    return ['ok' => true, 'pid' => trim((string) $pid)];
}

/** آخرین وضعیت و لاگ نصب. */
function install_status(): array
{
    $state = is_file(STATE_FILE) ? trim((string) file_get_contents(STATE_FILE)) : 'idle';
    $log = is_file(LOG_FILE) ? (string) file_get_contents(LOG_FILE) : '';

    // فقط انتهای لاگ لازم است؛ فرستادن کل آن در هر پیمایش، هدر دادن پهنای باند است.
    if (strlen($log) > 12000) {
        $log = "…\n" . substr($log, -12000);
    }

    if ($state === 'done' && !is_file(LOCK_FILE)) {
        file_put_contents(LOCK_FILE, date('c'));
    }

    return ['state' => $state, 'log' => $log];
}

// ── مسیریابی درخواست‌ها ───────────────────────────────────────────────

$action = $_GET['action'] ?? '';

if ($action === 'check') {
    json_out(checks());
}

if ($action === 'status') {
    json_out(install_status());
}

if ($action === 'install') {
    if (is_installed() && empty($_POST['force'])) {
        json_out(['ok' => false, 'error' => 'قبلا نصب شده است.']);
    }
    $port = (int) ($_POST['port'] ?? 8080);
    if ($port < 1024 || $port > 65535) {
        json_out(['ok' => false, 'error' => 'پورت باید بین ۱۰۲۴ تا ۶۵۵۳۵ باشد.']);
    }
    json_out(start_install([
        'port' => $port,
        'publicUrl' => (string) ($_POST['publicUrl'] ?? ''),
    ]));
}

$state = checks();
$installed = is_installed();
?>
<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>نصب SamaLine</title>
<style>
  /* پالت برند سماع؛ همان رنگ‌های پنل. */
  :root {
    --blue-600: #4b5f97; --blue-700: #324a7a; --blue-900: #1b2843;
    --gold-500: #b18a5a;
    --gray-50: #f6f8fb; --gray-200: #e0e5ee; --gray-500: #7b8699;
    --gray-700: #3f4859; --gray-900: #161c2a;
    --ok: #2e7d52; --warn: #c9881e; --bad: #c2403a;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--gray-50); color: var(--gray-700);
    font: 14px/1.7 Vazirmatn, Tahoma, sans-serif;
  }
  header {
    background: var(--blue-700); color: #fff;
    padding: 16px 20px; display: flex; align-items: center; gap: 10px;
  }
  .mark {
    width: 30px; height: 30px; border-radius: 6px; background: var(--gold-500);
    color: var(--blue-900); display: grid; place-items: center; font-weight: 700;
  }
  main { max-width: 780px; margin: 24px auto; padding: 0 16px; }
  .card {
    background: #fff; border: 1px solid var(--gray-200); border-radius: 8px;
    padding: 16px; margin-bottom: 16px;
  }
  h2 { margin: 0 0 12px; font-size: 17px; color: var(--gray-900); }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: start; padding: 7px 10px; border: 1px solid var(--gray-200); }
  th { background: var(--gray-50); font-weight: 600; }
  .pill {
    display: inline-block; padding: 1px 8px; border-radius: 999px;
    font-size: 12px; white-space: nowrap;
  }
  .pill.ok { background: #e9f5ee; color: var(--ok); }
  .pill.warn { background: #fbf1dd; color: var(--warn); }
  .pill.bad { background: #fbeceb; color: var(--bad); }
  .help { color: var(--gray-500); font-size: 12px; }
  label { display: block; margin-bottom: 12px; font-size: 13px; }
  input {
    width: 100%; margin-top: 4px; padding: 7px 10px; font: inherit;
    border: 1px solid #ccd4e0; border-radius: 6px;
  }
  button {
    font: inherit; padding: 8px 18px; border-radius: 6px; cursor: pointer;
    background: var(--blue-600); color: #fff; border: 1px solid var(--blue-600);
  }
  button:disabled { opacity: .5; cursor: default; }
  pre {
    background: var(--blue-900); color: #dbe3f5; padding: 12px;
    border-radius: 6px; max-height: 320px; overflow: auto;
    font-size: 12px; direction: ltr; text-align: left; white-space: pre-wrap;
  }
  .done { border-color: var(--ok); }
  .done h2 { color: var(--ok); }
  a { color: var(--blue-600); }
  .muted { color: var(--gray-500); font-size: 12px; }
</style>
</head>
<body>
<header>
  <span class="mark">س</span>
  <strong>نصب سامانه نظرسنجی SamaLine</strong>
</header>

<main>
<?php if ($installed): ?>
  <div class="card done">
    <h2>قبلا نصب شده است</h2>
    <p>اگر می‌خواهید دوباره نصب کنید، فایل <code>installer/.installed</code> را حذف کنید.</p>
    <p class="muted">برای امنیت، پس از پایان کار پوشه‌ی <code>installer</code> را از روی هاست پاک کنید.</p>
  </div>
<?php endif; ?>

  <div class="card">
    <h2>بررسی محیط</h2>
    <table>
      <thead><tr><th>مورد</th><th>وضعیت</th><th>مقدار</th></tr></thead>
      <tbody>
      <?php foreach ($state['items'] as $item): ?>
        <tr>
          <td>
            <?= htmlspecialchars($item['title'], ENT_QUOTES, 'UTF-8') ?>
            <?php if (!$item['ok']): ?>
              <div class="help"><?= htmlspecialchars($item['help'], ENT_QUOTES, 'UTF-8') ?></div>
            <?php endif; ?>
          </td>
          <td>
            <?php
              $cls = $item['ok'] ? 'ok' : ($item['fatal'] ? 'bad' : 'warn');
              $txt = $item['ok'] ? 'درست' : ($item['fatal'] ? 'لازم است' : 'هشدار');
            ?>
            <span class="pill <?= $cls ?>"><?= $txt ?></span>
          </td>
          <td style="direction:ltr;text-align:left">
            <?= htmlspecialchars((string) $item['value'], ENT_QUOTES, 'UTF-8') ?>
          </td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  </div>

<?php if ($state['canInstall']): ?>
  <div class="card" id="formCard">
    <h2>تنظیمات نصب</h2>
    <label>
      پورت اجرا
      <input type="number" id="port" value="8080" min="1024" max="65535">
      <span class="help">پورتی که روی هاست آزاد باشد. با Passenger (cPanel) این عدد استفاده نمی‌شود؛ پورت را خود cPanel می‌دهد.</span>
    </label>
    <label>
      مسیر Node (اختیاری)
      <input type="text" id="nodePath" dir="ltr"
             value="<?= htmlspecialchars((string) ($state['node']['path'] ?? ''), ENT_QUOTES, 'UTF-8') ?>">
      <span class="help">
        اگر خودکار پیدا نشد یا نسخه‌ی درستی نبود، مسیر را دستی بدهید.
        در cPanel معمولا چیزی شبیه <code dir="ltr">/home/USER/nodevenv/app/20/bin/node</code> است.
      </span>
    </label>
    <label>
      نشانی عمومی سامانه (اختیاری)
      <input type="text" id="publicUrl" placeholder="https://survey.example.com" dir="ltr">
      <span class="help">در تنظیمات ذخیره می‌شود. بدون آن، وبهوک ربات تلگرام ثبت نمی‌شود و فرمان‌های ربات کار نمی‌کنند.</span>
    </label>
    <button id="startBtn">شروع نصب</button>
    <p class="muted">نصب چند دقیقه طول می‌کشد. بستن این صفحه نصب را متوقف نمی‌کند.</p>
  </div>

  <div class="card" id="progressCard" style="display:none">
    <h2>در حال نصب…</h2>
    <pre id="log"></pre>
  </div>

  <div class="card done" id="doneCard" style="display:none">
    <h2>نصب کامل شد</h2>
    <p id="links"></p>
    <p class="muted">
      برای امنیت، پوشه‌ی <code>installer</code> را از روی هاست پاک کنید.
      اولین کاربر را از صفحه‌ی «ثبت‌نام» پنل بسازید.
    </p>
  </div>
<?php else: ?>
  <div class="card">
    <h2>نصب فعلا ممکن نیست</h2>
    <form method="get" style="margin-bottom:12px">
      <label>
        اگر مسیر Node را می‌دانید، اینجا بدهید و دوباره بررسی کنید
        <input type="text" name="nodePath" dir="ltr"
               placeholder="/home/USER/nodevenv/app/20/bin/node"
               value="<?= htmlspecialchars((string) ($_GET['nodePath'] ?? ''), ENT_QUOTES, 'UTF-8') ?>">
      </label>
      <button type="submit">بررسی دوباره</button>
    </form>
    <p>موارد قرمز بالا را با پشتیبانی هاست حل کنید و این صفحه را دوباره باز کنید.</p>
    <p class="muted">
      رایج‌ترین حالت روی cPanel: از بخش <strong>Setup Node.js App</strong> یک اپ با
      Node نسخه <?= MIN_NODE_MAJOR ?> یا بالاتر بسازید تا مفسر Node در دسترس قرار بگیرد.
    </p>
  </div>
<?php endif; ?>
</main>

<script>
(function () {
  var startBtn = document.getElementById('startBtn');
  if (!startBtn) return;

  var logBox = document.getElementById('log');
  var poll = null;

  function show(id, on) {
    var el = document.getElementById(id);
    if (el) el.style.display = on ? '' : 'none';
  }

  function finish(port) {
    clearInterval(poll);
    show('progressCard', false);
    show('doneCard', true);
    var base = (document.getElementById('publicUrl').value || '').replace(/\/$/, '')
      || (location.protocol + '//' + location.hostname + ':' + port);
    document.getElementById('links').innerHTML =
      'پنل مدیریت: <a href="' + base + '/panel" target="_blank">' + base + '/panel</a><br>' +
      'فرم‌ها: <a href="' + base + '/" target="_blank">' + base + '/</a>';
  }

  function watch(port) {
    poll = setInterval(function () {
      fetch('?action=status')
        .then(function (r) { return r.json(); })
        .then(function (s) {
          logBox.textContent = s.log || 'در حال شروع…';
          logBox.scrollTop = logBox.scrollHeight;
          if (s.state === 'done') finish(port);
          if (s.state === 'failed') {
            clearInterval(poll);
            document.querySelector('#progressCard h2').textContent = 'نصب ناموفق بود';
          }
        })
        .catch(function () { /* قطع موقت شبکه نباید پیمایش را بکشد. */ });
    }, 2000);
  }

  startBtn.addEventListener('click', function () {
    var port = document.getElementById('port').value;
    startBtn.disabled = true;
    startBtn.textContent = 'در حال شروع…';

    var body = new URLSearchParams();
    body.set('port', port);
    body.set('publicUrl', document.getElementById('publicUrl').value);
    body.set('nodePath', document.getElementById('nodePath').value);

    fetch('?action=install', { method: 'POST', body: body })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (!res.ok) {
          startBtn.disabled = false;
          startBtn.textContent = 'شروع نصب';
          alert(res.error || 'شروع نصب ناموفق بود.');
          return;
        }
        show('formCard', false);
        show('progressCard', true);
        watch(port);
      });
  });
})();
</script>
</body>
</html>
