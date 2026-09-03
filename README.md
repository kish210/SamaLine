# SamaLine — سامانه نظرسنجی و فرم‌ساز آنلاین

سامانه‌ی SaaS نظرسنجی، پرسشنامه، فرم‌ساز و آزمون‌ساز با پشتیبانی کامل از فارسی و RTL.
شرح کامل محصول و نقشه‌ی راه در [todo.md](todo.md).

## اجرا بدون Docker

پروژه به‌صورت خوداتکا اجرا می‌شود: دیتابیس پیش‌فرض **SQLite** است و به‌صورت یک فایل
داخل `backend/data/` ساخته می‌شود. هیچ سرویس بیرونی (Postgres، Redis، Docker) لازم نیست.

پیش‌نیاز: فقط Node.js نسخه‌ی ۲۰ به بالا.

```bash
# ۱) بک‌اند
cd backend
npm install
cp .env.example .env      # در ویندوز: copy .env.example .env
npm run db:seed           # ساخت اسکیما و ثبت پلن‌های پیش‌فرض
npm run start:dev         # http://localhost:3000
```

مستندات API (Swagger): `http://localhost:3000/api/docs`

```bash
# ۲) پنل مدیریت
cd panel && npm install && npm run dev

# ۳) رندر فرم برای پاسخ‌دهنده
cd form-renderer && npm install && npm run dev
```

## دیتابیس

| حالت | تنظیم | توضیح |
|---|---|---|
| پیش‌فرض (توسعه و On-Premise سبک) | `DB_DRIVER=sqlite` | فایل `backend/data/samaline.sqlite`؛ اسکیما خودکار ساخته می‌شود |
| تولید | `DB_DRIVER=postgres` + `DATABASE_URL` | مایگریشن‌های `src/database/migrations/` را دستی اجرا کنید |

نوع ستون‌ها در `backend/src/database/column-types.ts` بین دو درایور نگاشت می‌شود
(`jsonb`↔`simple-json`، `timestamptz`↔`datetime`، `ILIKE`↔`LIKE`).

## دستورهای بک‌اند

```bash
npm run start:dev    # اجرا با watch
npm run typecheck    # بررسی نوع‌ها
npm test             # تست‌های واحد
npm run lint         # اسلینت
npm run db:seed      # ساخت/به‌روزرسانی داده‌ی اولیه
```

## ساختار

```
backend/         NestJS + TypeORM — API، موتور منطق، موتور شاخص، گزارش‌گیری
panel/           پنل مدیریت (React + Vite)
form-renderer/   اپ سبک پاسخ‌دهنده (React + Vite)
todo.md          سند محصول و نقشه‌ی راه فازها
```
