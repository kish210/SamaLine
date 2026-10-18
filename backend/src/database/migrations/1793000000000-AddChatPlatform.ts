import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * افزودن ستون پیام‌رسان (تلگرام/بله) به یکپارچه‌سازی ربات (SQLite).
 *
 * پیش‌فرض 'telegram' است تا ردیف‌های موجود دست‌نخورده بمانند.
 */
export class AddChatPlatform1793000000000 implements MigrationInterface {
  name = 'AddChatPlatform1793000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "telegram_integrations" ADD "platform" varchar(16) NOT NULL DEFAULT ('telegram')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "telegram_integrations" DROP COLUMN "platform"`,
    );
  }
}
