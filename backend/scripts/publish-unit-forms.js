/**
 * انتشارِ لینکِ فرم‌های واحدهای استانداردِ هتل.
 *
 *   node scripts/publish-unit-forms.js owner@example.com
 *
 * فقط فرم‌هایی را منتشر می‌کند که به یکی از بخش‌های استاندارد (فنی، خانه‌داری،
 * منابع انسانی، IT، پیمانکاران) وصل‌اند و هنوز فعال نیستند؛ فرم‌های عمومیِ
 * سازمان دست‌نخورده می‌مانند. اجرای دوباره بی‌خطر است: فرمِ فعال دوباره لینک
 * نمی‌گیرد و همان توکنِ قبلی برگردانده می‌شود.
 *
 * خروجی: برای هر واحد، عنوانِ فرم، وضعیت و نشانیِ عمومیِ پاسخ‌دهی.
 */
const path = require('node:path');
const fs = require('node:fs');

// همان متغیرهای .env که سرویسِ systemd می‌گیرد.
const envFile = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

const email = (process.argv[2] ?? '').trim().toLowerCase();
if (!email || email.startsWith('--')) {
  console.error(
    'ایمیلِ یک عضوِ سازمان را بدهید. مثال: node scripts/publish-unit-forms.js owner@example.com',
  );
  process.exit(1);
}

/** بخش‌هایی که setup-hotel می‌سازد. */
const STANDARD_KEYS = ['technical', 'housekeeping', 'hr', 'it', 'contractors'];

(async () => {
  const { NestFactory } = require('@nestjs/core');
  const { AppModule } = require('../dist/app.module');
  const { DataSource } = require('typeorm');
  const { FormService } = require('../dist/forms/form.service');
  const { UserEntity } = require('../dist/database/entities/user.entity');
  const { OrganizationUserEntity } = require('../dist/database/entities/organization-user.entity');
  const { DepartmentEntity } = require('../dist/database/entities/department.entity');
  const { FormEntity, FormStatus } = require('../dist/database/entities/form.entity');

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

    const departments = await ds.getRepository(DepartmentEntity).find({
      where: { organizationId: member.organizationId },
    });
    const units = departments.filter((d) => STANDARD_KEYS.includes(d.key));
    if (units.length === 0) {
      throw new Error('هیچ بخشِ استانداردی برای این سازمان پیدا نشد.');
    }

    const forms = app.get(FormService);
    const base = (process.env.PUBLIC_URL ?? '').replace(/\/$/, '');
    const repo = ds.getRepository(FormEntity);

    for (const unit of units) {
      const own = await repo.find({
        where: { departmentId: unit.id },
        order: { createdAt: 'ASC' },
      });
      if (own.length === 0) {
        console.log(`• ${unit.name}: فرمی برای این بخش ساخته نشده است.`);
        continue;
      }
      for (const form of own) {
        if (form.status === FormStatus.ARCHIVED) continue;
        const publication = await forms.publishLink(form.id);
        const url = `${base}/f/${publication.token}`;
        console.log(`• ${unit.name}: «${form.title}» → ${url}`);
      }
    }
  } catch (error) {
    console.error('خطا:', error instanceof Error ? error.message : error);
    code = 1;
  } finally {
    await app.close();
  }
  process.exit(code);
})();
