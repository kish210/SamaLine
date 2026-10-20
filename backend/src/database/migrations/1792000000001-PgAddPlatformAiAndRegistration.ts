import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * نسخه‌ی Postgres مهاجرت افزودن تنظیمات هوش مصنوعی و سوئیچ ثبت‌نام.
 */
export class PgAddPlatformAiAndRegistration1792000000001 implements MigrationInterface {
  name = 'PgAddPlatformAiAndRegistration1792000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "platform_settings" ADD "registrationEnabled" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "platform_settings" ADD "aiProvider" character varying(20) NOT NULL DEFAULT 'mock'`,
    );
    await queryRunner.query(
      `ALTER TABLE "platform_settings" ADD "aiBaseUrl" character varying(300) NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "platform_settings" ADD "aiModel" character varying(120) NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "platform_settings" ADD "aiApiKey" character varying(500) NOT NULL DEFAULT ''`,
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
