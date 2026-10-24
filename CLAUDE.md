# راهنمای کار با این مخزن (برای ابزارهای AI و توسعه‌دهنده)

**اول این دو سند را بخوان، نه کل کد:**
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — نقشه‌ی کدبیس: سه اپ، ماژول‌ها،
  قراردادها، دستور آشپزی افزودن قابلیت.
- [docs/SCHEMA.md](docs/SCHEMA.md) — شمای دیتابیس: جدول‌ها، روابط، enumها، مهاجرت‌ها.

این‌ها برای همین نوشته شده‌اند که پیش از کار لازم نباشد مخزن از نو کاوش شود.
بعد از تغییرِ ساختاری، همان‌ها را هم به‌روز کن.

## قواعدی که نباید نقض شوند

- **مونوریپو، سه اپ:** `backend/` (NestJS)، `panel/` و `form-renderer/` (React/Vite).
  در تولید یک پروسه‌ی Node همه را سرو می‌کند.
- **دیتابیس دو گویش:** پیش‌فرض SQLite، با `DB_DRIVER=postgres` پستگرس. نوع ستون‌ها
  همیشه از `backend/src/database/column-types.ts` (مثل `JSON_COLUMN`,
  `TIMESTAMP_COLUMN`, `UUID_COLUMN`, `ENUM_COLUMN`) — نه نوع خام.
- **هر تغییر اسکیما = دو مهاجرت:** یک فایل SQLite + یک فایل `Pg…`، هر دو را در
  `backend/src/database/data-source.ts` (فهرست‌های `SQLITE_MIGRATIONS` و
  `POSTGRES_MIGRATIONS`) import و ثبت کن. موجودیت تازه را به `ALL_ENTITIES`
  (`entities/index.ts`) اضافه کن. سپس `schema-drift.spec.ts` باید سبز بماند
  (نام ایندکس را در موجودیت صریح بده تا با DDL یکی شود).
- **چندمستاجری:** `organizationId`/`workspaceId` همیشه از توکن JWT، نه از بدنه‌ی
  کلاینت. مالکیت با `TenantAccessService`؛ نقش با `@MinRole(...)`؛ سوپرادمین فقط
  از CLI (`npm run superadmin`).
- **پلن:** سقف هر قابلیت را با `PlanService` سر استفاده بررسی کن.
- **رازها:** کلیدهای API/AI با `common/secret-box.ts` رمز می‌شوند و هرگز از API
  برنمی‌گردند (فقط «تنظیم‌شده/نه»).
- **فارسی/RTL/شمسی:** رابط فارسی و RTL؛ تاریخ در DB میلادی (UTC)، در UI شمسی.

## دستورها

```bash
# بک‌اند: بیلد و تست (تست‌ها را با TZ=UTC اجرا کن؛ چند تست به منطقه‌ی زمانی حساس‌اند)
cd backend && npm run build && TZ=UTC npx jest

# تایپ‌چک/بیلد فرانت‌اند
cd panel && npm run build
cd form-renderer && npm run build
```

- commit فقط وقتی کاربر خواست. خروجی build (`dist/`, `node_modules/`) را commit نکن.
- استقرار روی سرور با `scripts/deploy.sh` (یا `install.sh`/`update.sh`/`manage.sh`)،
  نه دستی. جزئیات در ARCHITECTURE.md.
- مخزن **خصوصی** است؛ نصب روی سرور تازه از گیت به توکن نیاز دارد (README).
