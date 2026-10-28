/**
 * راه‌اندازیِ واحدهای استانداردِ هتل برای سازمانِ یک کاربر — همان کاری که
 * دکمه‌ی «راه‌اندازیِ واحدهای استانداردِ هتل» در صفحه‌ی «واحدهای هتل» می‌کند.
 *
 *   npm run setup-hotel -- owner@example.com
 *
 * از خروجیِ build (dist) و همان HotelSetupService استفاده می‌کند تا منطق یکی
 * بماند (بخش + فرمِ عملیاتیِ پیش‌نویس + داشبوردِ واحد). اجرای دوباره بی‌خطر است.
 * تنظیماتِ دیتابیس از backend/.env خوانده می‌شود؛ از پوشه‌ی backend اجرا کنید.
 */
const path = require('node:path');
const fs = require('node:fs');

// همان متغیرهایی که سرویسِ systemd از .env می‌گیرد.
const envFile = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

const email = (process.argv[2] ?? '').trim().toLowerCase();
if (!email || email.startsWith('--')) {
  console.error('ایمیلِ یک عضوِ سازمان را بدهید. مثال: npm run setup-hotel -- owner@example.com');
  process.exit(1);
}

(async () => {
  const { NestFactory } = require('@nestjs/core');
  const { AppModule } = require('../dist/app.module');
  const { HotelSetupService } = require('../dist/hotel-setup/hotel-setup.service');
  const { DataSource } = require('typeorm');
  const { UserEntity } = require('../dist/database/entities/user.entity');
  const { OrganizationUserEntity } = require('../dist/database/entities/organization-user.entity');
  const { WorkspaceEntity } = require('../dist/database/entities/workspace.entity');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  let code = 0;
  try {
    const ds = app.get(DataSource);
    const user = await ds.getRepository(UserEntity).findOne({ where: { email } });
    if (!user) throw new Error(`کاربری با ایمیل ${email} پیدا نشد.`);
    const member = await ds
      .getRepository(OrganizationUserEntity)
      .findOne({ where: { userId: user.id }, order: { createdAt: 'ASC' } });
    if (!member) throw new Error('این کاربر عضوِ هیچ سازمانی نیست.');
    const workspace = await ds
      .getRepository(WorkspaceEntity)
      .findOne({ where: { organizationId: member.organizationId }, order: { createdAt: 'ASC' } });
    if (!workspace) throw new Error('سازمان فضای کاری ندارد.');

    const result = await app
      .get(HotelSetupService)
      .setupStandardUnits(member.organizationId, workspace.id);
    for (const r of result) {
      console.log(
        `• ${r.name}: بخش ${r.department}، فرم ${r.form}، داشبورد ${r.dashboard}` +
          (r.portal ? `، پرتال ${r.portal}` : '') +
          (r.note ? ` — ${r.note}` : ''),
      );
    }
  } catch (error) {
    console.error(`خطا: ${error.message}`);
    code = 1;
  } finally {
    await app.close();
    process.exit(code);
  }
})();
