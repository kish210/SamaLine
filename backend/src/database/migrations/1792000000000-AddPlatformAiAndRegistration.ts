import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * افزودن تنظیمات هوش مصنوعی و سوئیچ ثبت‌نام به تنظیمات سکو (SQLite).
 *
 * ستون‌ها با مقدار پیش‌فرض اضافه می‌شوند تا ردیف موجودِ تنظیمات روی نصب‌های
 * قبلی نشکند؛ پیش‌فرض AI همان «mock» است، پس رفتار بدون تنظیم عوض نمی‌شود.
 */
export class AddPlatformAiAndRegistration1792000000000
  implements MigrationInterface
{
  name = 'AddPlatformAiAndRegistration1792000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "platform_settings" ADD "registrationEnabled" boolean NOT NULL DEFAULT (1)`,
    );
    await queryRunner.query(
      `ALTER TABLE "platform_settings" ADD "aiProvider" varchar(20) NOT NULL DEFAULT ('mock')`,
    );
    await queryRunner.query(
      `ALTER TABLE "platform_settings" ADD "aiBaseUrl" varchar(300) NOT NULL DEFAULT ('')`,
    );
    await queryRunner.query(
      `ALTER TABLE "platform_settings" ADD "aiModel" varchar(120) NOT NULL DEFAULT ('')`,
    );
    await queryRunner.query(
      `ALTER TABLE "platform_settings" ADD "aiApiKey" varchar(500) NOT NULL DEFAULT ('')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "platform_settings" DROP COLUMN "aiApiKey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "platform_settings" DROP COLUMN "aiModel"`,
    );
    await queryRunner.query(
      `ALTER TABLE "platform_settings" DROP COLUMN "aiBaseUrl"`,
    );
    await queryRunner.query(
      `ALTER TABLE "platform_settings" DROP COLUMN "aiProvider"`,
    );
    await queryRunner.query(
      `ALTER TABLE "platform_settings" DROP COLUMN "registrationEnabled"`,
    );
  }
}
