# نقشه‌ی کدبیس SamaLine

> سند مرجعِ معماری برای توسعه‌ی سریع‌تر و ارتقای کم‌هزینه‌تر. هدف این است که
> پیش از دست‌زدن به کد، همین یک فایل جای کاوشِ کل مخزن را بگیرد. هر بار که
> ساختار تغییر اساسی کرد، این فایل و [SCHEMA.md](SCHEMA.md) را به‌روز کنید.

## یک‌نگاه

سامانه‌ی نظرسنجی/فرم‌ساز چندمستاجری فارسی (RTL، تقویم شمسی). **مونوریپو با سه
اپ** که در تولید یک پروسه‌ی Node همه را سرو می‌کند:

| اپ | فناوری | نقش |
|---|---|---|
| `backend/` | NestJS + TypeORM | API، منطق، سرو کردن فایل‌های استاتیک دو اپ دیگر |
| `panel/` | React + Vite + TS | پنل مدیریت (زیر `/panel`) |
| `form-renderer/` | React + Vite + TS | نمایش فرم به پاسخ‌دهنده (زیر `/`)، کیوسک، پرتال، منو |

**دیتابیس:** پیش‌فرض SQLite (یک فایل، بدون سرویس)؛ با `DB_DRIVER=postgres`
پستگرس. هیچ وابستگی بیرونی اجباری نیست (نه داکر، نه nginx، نه ردیس).

**استقرار:** یک پروسه‌ی `node dist/main` با systemd، هم‌زمان روی HTTP (۸۰) و
HTTPS (۴۴۳). جزئیات در بخش «استقرار و عملیات».

## چیدمان مخزن

```
backend/          NestJS API + منطق دامنه + مهاجرت‌ها
  src/
    <module>/     هر قابلیت یک ماژول Nest (controller + service + dto)
    common/       گاردها، دکوراتورها، ابزار مشترک (نقش، رمزنگاری، tenant)
    database/     entities/ ، migrations/ ، data-source ، column-types
    testing/      test-database و کمک‌تست‌ها
  scripts/        CLIهای سرور (superadmin، set-ai، reset-*، smoke)
panel/            پنل مدیریت React
form-renderer/    اپ پاسخ‌دهنده React
scripts/          استقرار و عملیات (deploy, install, update, manage)
docs/             همین سند و SCHEMA.md
todo.md           سند تاریخچه/ممیزی (گزارش ایرادها و تغییرها)
REMAINING.md      امکانات هنوز پیاده‌نشده
```

## ماژول‌های بک‌اند

هر ماژول = پوشه‌ای با `*.module.ts` + controller + service(ها) + `dto.ts`.
پیشوند مسیرها زیر `/api/v1` است (`setGlobalPrefix('api/v1')`).

| ماژول | مسیر API | کار | موجودیت‌های اصلی |
|---|---|---|---|
| `auth` | `/auth` | ثبت‌نام/ورود، JWT، ۲FA (TOTP)، تغییر/بازیابی رمز | User |
| `organization` | `/organization` | سازمان و تنظیماتش | Organization |
| `workspaces` | `/workspaces` | فضای کاری | Workspace |
| `team` | `/team` | دعوت هم‌تیمی، نقش‌ها | Invitation، OrganizationUser |
| `forms` | `/forms` | فرم‌ساز، نسخه‌بندی، قالب‌ها، منطق، شاخص | Form، FormVersion |
| `templates` | (زیر `/forms/templates`) | کتابخانه‌ی قالب آماده | — (داده‌ی ثابت) |
| `responses` | `/responses` | جدول پاسخ‌ها، کامنت، فیلتر ذخیره‌شده | Response، ResponseComment، SavedFilter |
| `reports` | `/reports` | تجمیع آماری، داشبوردساز (`AnalyticsService`) | Dashboard |
| `distribution` | `/distribution` | انتشار و احراز پاسخ‌دهنده، کیوسک، پرسشگر | Publication، KioskSession، InterviewerQuota، OtpChallenge |
| `public` | `/public/*`, `/health` | مسیرهای بدون‌احراز: فرم عمومی، ثبت پاسخ، پرتال، منو، داشبورد عمومی، وبهوک تلگرام، پذیرش دعوت، سلامت | — |
| `contacts` | `/contacts` | دفترچه مخاطبان + اتصال به CRM | ContactList، Contact، ContactSource |
| `messaging` | `/messaging` | ارسال پیامک/ایمیل، صف پایدار، کمپین | DeliveryLog، QueuedJob |
| `integrations` | `/integrations` | وبهوک، تلگرام/بله، گزارش دوره‌ای ایمیلی | Webhook، TelegramIntegration/Recipient/LinkCode، EmailReportRecipient |
| `reminders` | (زمان‌بند) | یادآوری فرم‌های نیمه‌تمام | — |
| `ai` | `/ai` | ساخت/بازنگری فرم، تحلیل، ترجمه با AI | — (تنظیمات در PlatformSettings) |
| `plans` | `/plans` | سیاست پلن و اعمال سقف‌ها (`PlanService`) | PlanPolicy، Subscription، UsageCounter |
| `billing` | `/billing` | فاکتور و پرداخت (زرین‌پال) | Invoice، Payment |
| `channels` | `/channels` | تنظیم سرویس‌دهنده‌های پیام (SMTP/پیامک) | — |
| `menus` | `/menus`, `/public/menu` | منوی QR: محتوا (قالب‌های آماده، قابل تعویض روی منوی موجود) + ظاهر (`theme`، شش ظاهرِ آماده در `templates/menu-themes.ts`) | Menu |
| `departments` | `/departments` | بخش‌های هتل و عضویت؛ پایه‌ی دسترسی per-بخش (فاز A) | Department، DepartmentMember |
| `checklists` | (زمان‌بند) | چک‌لیستِ موعددار و هشدارِ انجام‌نشده (فاز C) | — |
| `rooms` | `/rooms` | اتاق‌های هتل به‌عنوان داده‌ی پایه + ساخت گروهی (فاز D) | HotelRoom |
| `hr` | `/hr/personnel` | پروندهٔ پرسنل، اتصالِ ربات با موبایل، گزارشِ درخواست‌های هر پرسنل (`HrStatsService`) | Personnel |
| `hotel-setup` | `/hotel-setup` | راه‌اندازیِ یک‌کلیکیِ واحدهای استاندارد (بخش + فرمِ عملیاتی + داشبورد)؛ CLI: `npm run setup-hotel` | — |

`integrations` علاوه بر بالا رباتِ پرسنل (`StaffBotService`: اتصال با موبایل،
`/me`، `/درخواست‌ها`، `/اطلاعیه`)، اعلانِ نتیجهٔ تأیید (`StaffNotifyService`) و
اطلاعیه‌ی سازمانی (`/hr/announcements`، موجودیت Announcement) را دارد. گردش‌کارِ
تأییدِ درخواست‌ها (`requiresApproval` در تنظیماتِ فرم، `meta.review` روی پاسخ) و
کارتابلِ تأیید (`/responses/pending`) در `responses` است. ماژول‌های تعمیرات و
سردخانه در ۱.۶.۸ حذف شدند (فرم‌محور).
| `platform` | `/platform` | تنظیمات سکو، سوپرادمین، AI، نوار پایین، ثبت‌نام | PlatformSettings |
| `admin` | `/admin` | ابزار مدیر کل روی سازمان‌ها/پلن‌ها | — |
| `ops` | `/ops` | پایش و کنترل سرویس systemd از پنل سوپرادمین | — |
| `uploads` | `/uploads` | آپلود فایل (لوگو و ضمیمه) | — |
| `identity`/OAuth-LDAP | — | `IdentityProvider` ذخیره می‌شود (جریان ورود ناقص) | IdentityProvider |

ماژول `common` گاردها و ابزار مشترک را دارد؛ `database` منبع حقیقت اسکیما.

## قراردادهای عرضی (مهم‌ترین‌ها)

- **دو گویش دیتابیس — `database/column-types.ts`:** به‌جای نوع خام همیشه از
  ثابت‌ها استفاده کنید: `JSON_COLUMN`، `TIMESTAMP_COLUMN`, `ENUM_COLUMN`,
  `UUID_COLUMN`, `NOW_SQL`, `LIKE_OPERATOR`. SQLite و Postgres نوع‌های متفاوت
  دارند و این لایه آن را یکدست می‌کند.
- **مهاجرت‌ها — `database/data-source.ts`:** مهاجرت‌ها **به‌صورت کلاس import**
  می‌شوند (نه glob مسیر) و دو فهرست جدا دارند: `SQLITE_MIGRATIONS` و
  `POSTGRES_MIGRATIONS`. هر تغییر اسکیما **دو فایل** می‌خواهد (SQLite و Pg) که
  هر دو در data-source ثبت شوند. `migrate-on-boot.ts` هنگام بالا آمدن اجرا
  می‌کند و نصبِ قدیمیِ بدون جدول migrations را «baseline» می‌زند. پیش از اجرا
  روی SQLite پشتیبان می‌گیرد.
- **تست هم‌خوانی اسکیما — `database/schema-drift.spec.ts`:** پس از همه‌ی
  مهاجرت‌ها نباید تغییر اسکیمای باقی‌مانده‌ای باشد. اگر موجودیت و مهاجرت
  واگرا شوند این تست قرمز می‌شود (مثلاً نام ایندکس). **نام ایندکس در موجودیت
  را صریح بدهید** تا با DDL مهاجرت یکی شود.
- **چندمستاجری و نقش — `common/`:** `organizationId`/`workspaceId` همیشه از
  توکن JWT خوانده می‌شود نه از بدنه‌ی کلاینت. `TenantAccessService.assertWorkspace`
  مالکیت را بررسی می‌کند. پنج نقش سازمانی (`OrganizationRole`) با دکوراتور
  `@MinRole(...)` روی کنترلرها اعمال می‌شود.
- **سوپرادمین:** فرامستاجری، فقط از CLI تعیین می‌شود (`npm run superadmin`)؛
  گارد `SuperAdminGuard` از دیتابیس می‌خواند نه از توکن.
- **اعمال پلن — `PlanService`:** هر قابلیت سر استفاده سقفش را از پلن سازمان
  می‌خواند (`-1` = نامحدود). قالب آماده روی پلن پایین‌تر هرس می‌شود نه رد.
- **رمزنگاری ستون — `common/secret-box.ts`:** رازها (کلید API سرویس‌های
  بیرونی، کلید AI) با AES-256-GCM و پیشوند `enc:v1:` رمز می‌شوند. کلید از
  `SECRET_ENCRYPTION_KEY` (یا در نبودش `JWT_SECRET`) مشتق می‌شود. رازها هرگز
  از API برنمی‌گردند؛ فقط «تنظیم‌شده/نه».
- **پیام‌رسانی — `messaging/`:** الگوی Provider: `MessagingProvider` با کانال
  `sms|email`. پیاده‌سازی‌ها: `local-file` (پیش‌فرض، بدون سرویس بیرونی)،
  `kavenegar`، `smtp`، `webhook`. با `EMAIL_PROVIDER`/`SMS_PROVIDER` سوئیچ
  می‌شود. صف پایدار روی دیتابیس (`QueuedJob`) با بازیابی کارهای نیمه‌تمام.
- **تلگرام و بله — `integrations/`:** API ربات بله (`tapi.bale.ai`) با تلگرام
  سازگار است؛ `telegram-api.ts` با `platformApiBase(platform)` آدرس پایه را
  انتخاب می‌کند. هر فضای کاری یک ربات دارد (ستون `platform` روی
  TelegramIntegration).
- **i18n/RTL/شمسی:** رشته‌ها از فایل ترجمه، جهت پیش‌فرض RTL، تاریخ در DB میلادی
  (UTC) و در UI شمسی (`common/jalali.ts`، `panel/src/jalali.ts`).
- **سرو کردن SPA — `backend/src/main.ts`:** بک‌اند فایل‌های build دو اپ React را
  سرو می‌کند: رندرر زیر `/`، پنل زیر `/panel`. مسیر پوششی SPA فقط به درخواست
  مرورگر (`Accept: text/html`) `index.html` می‌دهد؛ مسیرهای `/api` و `/uploads`
  کنار گذاشته می‌شوند. آپلودها زیر `/uploads/`.
- **HTTP + HTTPS هم‌زمان:** اگر `TLS_CERT`/`TLS_KEY` در env باشند، `main.ts` با
  `app.init()` یک express را روی دو سرور `http` (PORT) و `https` (HTTPS_PORT)
  می‌گذارد. بدون گواهی، فقط `app.listen(PORT)`.

## فرانت‌اند — پنل (`panel/src`)

- `api.ts` تنها لایه‌ی تماس با بک‌اند (axios، تزریق توکن، پایه‌ی نسبی `/api/v1`).
- `auth.ts` نشست (zustand)، `i18n.ts`/`jalali.ts` بومی‌سازی.
- `pages/` هر صفحه: Forms، FormBuilder، Responses (در builder)، Dashboards،
  Contacts/ContactSources، Campaigns، Portals، Menus، Settings،
  PlatformSettings (سوپرادمین)، Login/AcceptInvite/ResetPassword، Ai.
- `pages/builder/` اجزای فرم‌ساز: QuestionEditor، AddQuestionMenu،
  DisplayRuleEditor/SkipRuleEditor، FlowChart، IndicatorEditor، ThemeEditor،
  LivePreview، QuestionCharts/RadarChart، ReminderEditor، PublishCard،
  ResponsesPanel، AiReviewCard.
- کارت‌های تنظیمات: TeamCard، ApiKeysCard، WebhooksCard، TelegramCard،
  EmailReportCard، TwoFactorCard، ChangePasswordCard، OrganizationPlansCard،
  ServiceMonitorCard.

## فرانت‌اند — رندرر (`form-renderer/src`)

نمایش سریع و PWA. `useFormFlow.ts` مسیر سوال‌به‌سوال (منطق از سرور می‌آید)،
`FormScreen`/`QuestionField` + `fields/*`، `validate.ts`، `useTheme.ts`،
`JalaliDatePicker`، `RespondentAuth` (رمز/OTP)، `offline-outbox.ts` (کیوسک
آفلاین)، صفحات `KioskPage`/`PortalPage`/`MenuPage`/`PublicDashboard`.

## استقرار و عملیات (`scripts/`)

- `deploy.sh` — استقرار/به‌روزرسانی روی خود سرور: نصب وابستگی (`npm ci`)،
  build سه اپ، **بررسیِ خروجیِ ساخت** (اگر `backend/dist/main.js` یا
  `index.html`ِ پنل/رندرر نباشد، پیش از دست زدن به سرویس با خطا می‌ایستد)،
  ساخت `.env` با کلیدهای تصادفی، سرویس systemd، گواهی TLS (self-signed پیش‌فرض)،
  **سپس `tls-letsencrypt.sh`** (اگر دامنه و acme.sh باشد، گواهیِ معتبر تمدید/نصب
  می‌شود)، باز کردن پورت فایروال، بررسی سلامت. نصب دوباره پورت قبلی را از `.env`
  حفظ می‌کند.
- `tls-letsencrypt.sh` — صدور/تمدید/نصبِ گواهیِ Let's Encrypt با acme.sh برای
  میزبانِ `PUBLIC_URL`. چون برنامه ۴۴۳ را نگه داشته، چالشِ ALPN با هوکِ
  stop/start سرویس اجرا می‌شود و همین هوک‌ها در تنظیماتِ acme ذخیره می‌شوند تا
  cronِ تمدیدِ خودکار هم کار کند. گواهی در `backend/certs/server.{crt,key}`
  نصب می‌شود. اجرای دوباره بی‌خطر است.
- `install.sh` — راه‌انداز سرور تازه: پیش‌نیازها + deploy با `ALLOW_NODE_INSTALL`.
- `update.sh` — `git pull --ff-only` سپس deploy.
- `manage.sh` — منوی مدیریت: وضعیت/ری‌استارت، به‌روزرسانی، پورت‌ها، نشانی شبکه،
  گواهی TLS، سوپرادمین، کاربر (reset رمز/۲FA)، هوش مصنوعی.
- CLIهای بک‌اند: `npm run superadmin|set-ai|reset-password|reset-2fa|smoke|setup-hotel`.
- متغیرهای کلیدی `.env`: `PORT`/`HTTPS_PORT`، `TLS_CERT`/`TLS_KEY`، `PUBLIC_URL`،
  `DB_DRIVER`، `JWT_SECRET`، `SECRET_ENCRYPTION_KEY`، `EMAIL_PROVIDER`/`SMS_PROVIDER`.
- **گواهی واقعی:** چون فقط ۴۴۳ ممکن است باز باشد، با `acme.sh --alpn` (TLS-ALPN-01
  روی ۴۴۳) گواهی Let's Encrypt گرفته می‌شود — از راهِ `scripts/tls-letsencrypt.sh`
  یا گزینه‌ی ۴ِ منوی TLS. گزینه‌ی self-signedِ منو وقتی گواهیِ معتبر نصب است، بدونِ
  تأییدِ صریح جایگزینش نمی‌کند (self-signed در مرورگر خطای SSL می‌دهد).
- پشتیبان روزانه‌ی خودکار SQLite در `backend/data/backups/`.

## افزودن قابلیت — دستور آشپزی کوتاه

- **ستون/جدول تازه:** موجودیت در `database/entities/` + افزودن به `ALL_ENTITIES`
  (`entities/index.ts`) + **دو** مهاجرت (SQLite و Pg) + ثبت هر دو در
  `data-source.ts`. سپس `TZ=UTC npx jest schema-drift` تا هم‌خوانی تأیید شود.
- **ماژول تازه:** پوشه با module/controller/service/dto + افزودن به `app.module.ts`.
  گارد `JwtAuthGuard` + `@MinRole` بگذارید؛ `organizationId` را از توکن بخوانید.
- **نوع سوال تازه:** رندرر `fields/*` + `QuestionField` + `validate.ts`؛ پنل
  `builder/QuestionEditor` و کاتالوگ؛ اعتبارسنجی پاسخ در `public`/`responses`.
- **سقف پلن تازه:** کلید در `PlanPolicy.limits` + بررسی با `PlanService` سر استفاده.
- **سرویس‌دهنده پیام تازه:** کلاس `MessagingProvider` + سوئیچ در
  `messaging.service.ts` با متغیر محیطی.

## تست

- `cd backend && npx jest` — یک سوئیت بزرگ روی دیتابیس واقعیِ تست (SQLite موقت).
- **با `TZ=UTC` اجرا کنید؛** چند تست به مقایسه‌ی زمان UTC حساس‌اند و روی ماشینِ
  با منطقه‌ی زمانی غیر UTC قرمز می‌شوند (باگ نیست).
- تایپ‌چک: `npm run build` در هر سه اپ (پنل/رندرر `tsc -b` دارند).
