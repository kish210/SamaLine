import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * اتصالِ هویت و پیام‌رسان (SQLite).
 *
 * سه کار: حسابِ کاربریِ هر پرسنل، جدولِ چندسکوییِ اتصالِ ربات، و کدِ
 * اتصالِ پرسنلی. ستون‌های قدیمیِ اتصال (`botChatId`…) **حذف نمی‌شوند**:
 * ردیف‌هایشان به جدولِ تازه کپی می‌شود و خودشان برای سازگاریِ نصب‌های موجود
 * می‌مانند. حذفشان کارِ یک مهاجرتِ جداست، بعد از اینکه مطمئن شدیم چیزی
 * نمی‌خواندشان.
 */
export class AddIdentityAndBotLinks1800000000024
  implements MigrationInterface
{
  name = 'AddIdentityAndBotLinks1800000000024';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "personnel" ADD COLUMN "userId" varchar`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_personnel_user" ON "personnel" ("organizationId", "userId")`,
    );

    await queryRunner.query(
      `CREATE TABLE "personnel_bot_links" (` +
        `"id" varchar PRIMARY KEY NOT NULL, ` +
        `"organizationId" varchar NOT NULL, ` +
        `"personnelId" varchar NOT NULL, ` +
        `"platform" varchar(16) NOT NULL, ` +
        `"chatId" varchar(64) NOT NULL, ` +
        `"workspaceId" varchar, ` +
        `"linkedAt" datetime NOT NULL DEFAULT (datetime('now')), ` +
        `"lastSeenAt" datetime` +
        `)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_pbl_platform_chat" ON "personnel_bot_links" ("platform", "chatId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_pbl_person_platform" ON "personnel_bot_links" ("personnelId", "platform")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pbl_org" ON "personnel_bot_links" ("organizationId")`,
    );

    /*
     * اتصال‌های موجود به جدولِ تازه می‌آیند.
     *
     * بدونِ این، پرسنلی که همین حالا به ربات وصل است پس از استقرار بی‌صدا
     * قطع می‌شد و دیگر اطلاعیه و یادآوری نمی‌گرفت. `hex(randomblob(16))`
     * شناسه‌ی یکتا می‌سازد چون SQLite تابعِ uuid ندارد.
     */
    await queryRunner.query(
      `INSERT INTO "personnel_bot_links" ("id", "organizationId", "personnelId", "platform", "chatId", "workspaceId", "linkedAt") ` +
        `SELECT lower(hex(randomblob(16))), "organizationId", "id", ` +
        `CASE WHEN "botPlatform" = '' THEN 'bale' ELSE "botPlatform" END, ` +
        `"botChatId", "botWorkspaceId", datetime('now') ` +
        `FROM "personnel" WHERE "botChatId" IS NOT NULL AND "botChatId" <> ''`,
    );

    await queryRunner.query(
      `ALTER TABLE "telegram_link_codes" ADD COLUMN "personnelId" varchar`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "telegram_link_codes" DROP COLUMN "personnelId"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_pbl_org"`);
    await queryRunner.query(`DROP INDEX "IDX_pbl_person_platform"`);
    await queryRunner.query(`DROP INDEX "IDX_pbl_platform_chat"`);
    await queryRunner.query(`DROP TABLE "personnel_bot_links"`);
    await queryRunner.query(`DROP INDEX "IDX_personnel_user"`);
    await queryRunner.query(`ALTER TABLE "personnel" DROP COLUMN "userId"`);
  }
}
