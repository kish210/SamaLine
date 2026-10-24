# شمای دیتابیس SamaLine

> مرجعِ جدول‌ها و روابط، از روی موجودیت‌های TypeORM (`backend/src/database/entities/`).
> منبع حقیقتِ جاری همان موجودیت‌هاست و تست `schema-drift.spec.ts` تضمین می‌کند
> مهاجرت‌ها با آن‌ها هم‌خوان‌اند. هنگام تغییر اسکیما، این فایل را هم به‌روز کنید.

## گویش و نوع‌ها

پیش‌فرض **SQLite** (یک فایل)، با `DB_DRIVER=postgres` **Postgres**. نوع‌ها از
`column-types.ts` می‌آیند؛ نگاشت:

| ثابت | SQLite | Postgres |
|---|---|---|
| `UUID_COLUMN` | varchar | uuid |
| `JSON_COLUMN` | simple-json | jsonb |
| `TIMESTAMP_COLUMN` | datetime | timestamptz |
| `ENUM_COLUMN` | simple-enum | enum |

کلید اصلی همه‌ی جدول‌ها `id` (uuid تولیدشده) است مگر `platform_settings`
(کلید ثابت `singleton`). ستون‌های `createdAt/updatedAt` در بیشتر جدول‌ها هست و
برای اختصار تکرار نشده. `*` یعنی nullable.

## سلسله‌مراتب چندمستاجری

```
Organization ── OrganizationUser ── User            (عضویت + نقش RBAC)
     │
     ├── Workspace ── Form ── FormVersion ── Response ── Answer(flat)/Comment
     │                 │
     │                 └── Publication (کانال انتشار) ── DeliveryLog/Otp/Kiosk/Quota
     ├── Subscription / UsageCounter / Invoice / Payment      (تجاری)
     └── ApiKey / Webhook / AuditLog / ContactList            (سازمانی)
```

تنظیمات سکو (`platform_settings`) و `plan_policies` فرامستاجری‌اند (به سازمان
تعلق ندارند).

## جدول‌ها

### هویت و سازمان
- **users** — `fullName`, `email`(یکتا), `passwordHash`, `isSuperAdmin`,
  `totpSecret*`, `totpEnabled`, `totpLastStep*`, `passwordChangedAt*`,
  `passwordResetHash*`, `passwordResetExpiresAt*`.
- **organizations** — `name`. روابط: workspaces، users، subscriptions، usageCounters.
- **organization_users** — `organizationId`, `userId`, `role` (OrganizationRole). عضویت N:N.
- **workspaces** — `organizationId`, `name`. → forms.
- **invitations** — `organizationId`, `email`, `role`, `tokenHash`(یکتا),
  `invitedBy`, `expiresAt`, `acceptedAt*`. دعوت هم‌تیمی با لینک یک‌بارمصرف.
- **identity_providers** — `organizationId`, `type` (OAuth/LDAP), `name`,
  `config`(JSON), `isActive`. (ذخیره می‌شود؛ جریان ورود ناقص.)

### فرم و پاسخ
- **forms** — `workspaceId`, `title`, `slug`(یکتا), `status` (FormStatus:
  draft/active/closed/archived), `settings`(JSON: تم، صفحات شروع/پایان، حالت نمایش…).
- **form_versions** — `formId`, `version`(int), `structure`(JSON: صفحات/سوال/منطق/شاخص).
  نسخه‌بندی تا تغییر فرم پاسخ‌های قبلی را خراب نکند.
- **responses** — `formVersionId`, `publicationId`, `respondentKey*`, `status`
  (ResponseStatus: partial/completed), `startedAt`, `submittedAt*`,
  `durationSeconds*`, `meta`(JSON: ip، منبع، UA…), `answers`(JSON), `scores`(JSON).
- **answer_flat** — `responseId`, `questionId`, `valueText*`, `valueNumber*`,
  `choiceId*`. جدول تخت برای گزارش‌گیری سریع (Materialized).
- **response_comments** — `responseId`, `authorName`, `body`. کامنت تیمی روی پاسخ.
- **saved_filters** — `workspaceId`, `definition`(JSON). فیلتر ذخیره‌شده‌ی گزارش.
- **dashboards** — `organizationId`, `name`, `widgets`(JSON: نوع/عنوان/چیدمان),
  `isPublic`, `publicToken*`(یکتا). داشبوردساز با اشتراک عمومی.

### انتشار و کانال‌ها
- **publications** — `formId`, `authMode` (PublicationAuthMode:
  none/param/link/password/otp/oauth/ldap), `token`, `slug*`, `tags`,
  `customDomain*`, `expiresAt*`, `quota*`, `config`(JSON), `viewCount`, `isActive`.
- **delivery_logs** — `publicationId`, `channel`, `status`, `payload`(JSON),
  `providerMessage*`. لاگ ارسال پیامک/ایمیل.
- **otp_challenges** — `publicationId`, `destination`, `codeHash`, `expiresAt`,
  `attempts`, `consumed`. کد یک‌بارمصرف احراز پاسخ‌دهنده.
- **kiosk_sessions** — `publicationId`, `deviceCode`, `isLocked`,
  `lastSyncPayload`(JSON), `lastSyncedAt*`. کیوسک و همگام‌سازی آفلاین.
- **interviewer_quotas** — `publicationId`, `interviewerName`, `assignedQuota`,
  `usedQuota`. سهمیه‌ی پرسشگر میدانی.

### مخاطبان و پیام
- **contact_lists** — `organizationId`, `name`, `tags`. → contacts.
- **contacts** — `listId`, `fullName*`, `mobile*`, `email*`, `variables`(JSON),
  `tags`, `unsubscribed`. ایندکس روی (listId,mobile) و (listId,email).
- **contact_sources** — `organizationId`, `listId`, `name`, `url`, `method`,
  `headers`/`body`/`mapping`(JSON رمزشده), `itemsPath`, `isActive`, `lastSyncedAt*`,
  `lastResult`(JSON). اتصال به CRM.
- **queued_jobs** — `kind`, `payload`(JSON), `status` (JobStatus), `attempts`,
  `maxAttempts`, `runAfter`, `lastError*`. صف پایدار درون‌فرایندی.

### یکپارچه‌سازی
- **webhooks** — `organizationId`, `event`, `targetUrl`, `secret`, `isActive`.
  تحویل با امضای HMAC و تلاش دوباره.
- **telegram_integrations** — `workspaceId`(یکتا), `botToken`, `platform`
  (`telegram`/`bale`), `webhookToken*`(یکتا), `botUsername*`, `isActive`,
  `lastError*`, `lastSentAt*`. یک ربات برای هر فضای کاری.
- **telegram_recipients** — `workspaceId`, `formId*`, `chatId`, `label`,
  `scoreThreshold*`, `isActive`, `notifyOnResponse`, `digest`
  (none/weekly/monthly), `lastDigestAt*`, `lastError*`, `lastSentAt*`.
- **telegram_link_codes** — `code`, `workspaceId`, `formId*`, `label`,
  `expiresAt`, `maxUses*`, `useCount`, `usedAt*`. وصل‌کردن گفتگو از داخل ربات.
- **email_report_recipients** — `workspaceId`, `formId*`, `email`, `label`,
  `digest` (weekly/monthly), `isActive`, `lastDigestAt*`, `lastError*`,
  `lastSentAt*`. گزارش دوره‌ای ایمیلی. ایندکس (workspaceId,formId).

### تجاری و پلن
- **plan_policies** — `planCode` (PlanCode: free/pro/org/enterprise),
  `limits`(JSON سقف‌ها). فرامستاجری، قابل‌ویرایش.
- **subscriptions** — `organizationId`, `planCode`, `expiresAt*`, `isActive`,
  `overrides`(JSON). اشتراک فعال سازمان.
- **usage_counters** — `organizationId`, `periodKey`, `metric`, `used`,
  `limitValue`. شمارنده‌ی مصرف ماهانه.
- **invoices** — `organizationId`, `invoiceNo`(یکتا), `status` (InvoiceStatus),
  `amount`(bigint), `metadata`(JSON).
- **payments** — `invoiceId`, `gateway`, `status` (PaymentStatus), `amount`,
  `referenceCode*`, `authority*`, `metadata`(JSON). تایید از خود درگاه.
- **onprem_licenses** — `organizationId`, `licenseKey`, `capabilities`(JSON),
  `expiresAt*`, `isActive`. (صدور/اعتبارسنجی هست؛ بررسی هنگام اجرا هنوز نه.)

### سکو و متفرقه
- **platform_settings** — کلید ثابت `singleton`. `footerEnabled/Text/Url`
  (نوار پایین فرم‌ها)، `registrationEnabled` (سوئیچ ثبت‌نام)، `aiProvider`
  (`mock`/`openai`)، `aiBaseUrl`، `aiModel`، `aiApiKey` (رمزشده). فقط سوپرادمین.
- **audit_logs** — `organizationId`, `action`, `actorType`, `actorId*`,
  `payload`(JSON). (جدول هست؛ نوشتن رویداد هنوز کامل نیست.)
- **menus** — `workspaceId`, `slug`(یکتا), `title`, `description`, `logoUrl`,
  `images`, `sections`(JSON)، `isActive`. منوی دیجیتال (قابلیت افزوده).
- **api_keys** — `organizationId`, `name`, `keyPrefix`(یکتا), `keyHash`,
  `isActive`, `role` (OrganizationRole), `lastUsedAt*`, `expiresAt*`,
  `scopes`(JSON). احراز با `X-API-Key` یا `Authorization: Bearer sl_…`.

## Enumها (در `database/entities/`)

- **OrganizationRole**: owner / admin / editor / analyst / viewer
- **FormStatus**: draft / active / closed / archived
- **ResponseStatus**: partial / completed
- **PlanCode**: free / pro / org / enterprise (نام‌های داخلی)
- **PublicationAuthMode**: none / param / link / password / otp / oauth / ldap
- **InvoiceStatus**, **PaymentStatus**, **JobStatus**, **IdentityProviderType** —
  در فایل موجودیت همان‌ها.

## مهاجرت‌ها

ترتیب در `data-source.ts` (دو فهرست جدا برای SQLite و Postgres):

1. `Baseline` — همه‌ی جدول‌های پایه.
2. `AddPortal` — جدول portals.
3. `AddTotp` — ستون‌های ۲FA روی users.
4. `AddPasswordReset` — ستون‌های بازیابی رمز روی users.
5. `AddInvitations` — جدول invitations.
6. `AddApiKeyRole` — ستون‌های نقش/اسکوپ روی api_keys.
7. `AddPlatformAiAndRegistration` — `registrationEnabled`+ستون‌های AI روی platform_settings.
8. `AddMenus` — جدول menus.
9. `AddChatPlatform` — ستون `platform` روی telegram_integrations.
10. `AddEmailReports` — جدول email_report_recipients.

**قاعده:** هر تغییر اسکیما = یک فایل `<ts>-X.ts` (SQLite) + یک `<ts+1>-PgX.ts`
(Postgres)، هر دو import و در فهرست مربوط ثبت شوند. `migrate-on-boot.ts` هنگام
بوت اجرا می‌کند؛ نصب‌های قدیمی بدون جدول `migrations` را «baseline» می‌زند و
پیش از اجرا روی SQLite پشتیبان می‌گیرد. جدول‌های `temporary_*` که ممکن است در
SQLite ببینید، artifactِ بازسازی جدول توسط TypeORM‌اند، نه جدول واقعی.
