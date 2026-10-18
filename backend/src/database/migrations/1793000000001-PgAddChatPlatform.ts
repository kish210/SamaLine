import { MigrationInterface, QueryRunner } from 'typeorm';

/** نسخه‌ی Postgres افزودن ستون پیام‌رسان به یکپارچه‌سازی ربات. */
export class PgAddChatPlatform1793000000001 implements MigrationInterface {
  name = 'PgAddChatPlatform1793000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "telegram_integrations" ADD "platform" character varying(16) NOT NULL DEFAULT 'telegram'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "telegram_integrations" DROP COLUMN "platform"`,
    );
  }
}
