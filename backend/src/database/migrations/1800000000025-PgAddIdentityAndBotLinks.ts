import { MigrationInterface, QueryRunner } from 'typeorm';

/** اتصالِ هویت و پیام‌رسان (Postgres). */
export class PgAddIdentityAndBotLinks1800000000025
  implements MigrationInterface
{
  name = 'PgAddIdentityAndBotLinks1800000000025';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "personnel" ADD "userId" uuid`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_personnel_user" ON "personnel" ("organizationId", "userId")`,
    );

    await queryRunner.query(
      `CREATE TABLE "personnel_bot_links" (` +
        `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), ` +
        `"organizationId" uuid NOT NULL, ` +
        `"personnelId" uuid NOT NULL, ` +
        `"platform" character varying(16) NOT NULL, ` +
        `"chatId" character varying(64) NOT NULL, ` +
        `"workspaceId" uuid, ` +
        `"linkedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `"lastSeenAt" TIMESTAMP WITH TIME ZONE, ` +
        `CONSTRAINT "PK_personnel_bot_links" PRIMARY KEY ("id")` +
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

    // اتصال‌های موجود منتقل می‌شوند تا پرسنلِ وصل‌شده بی‌صدا قطع نشود.
    await queryRunner.query(
      `INSERT INTO "personnel_bot_links" ("organizationId", "personnelId", "platform", "chatId", "workspaceId") ` +
        `SELECT "organizationId", "id", ` +
        `CASE WHEN "botPlatform" = '' THEN 'bale' ELSE "botPlatform" END, ` +
        `"botChatId", "botWorkspaceId" ` +
        `FROM "personnel" WHERE "botChatId" IS NOT NULL AND "botChatId" <> ''`,
    );

    await queryRunner.query(
      `ALTER TABLE "telegram_link_codes" ADD "personnelId" uuid`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "telegram_link_codes" DROP COLUMN "personnelId"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_pbl_org"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_pbl_person_platform"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_pbl_platform_chat"`);
    await queryRunner.query(`DROP TABLE "personnel_bot_links"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_personnel_user"`);
    await queryRunner.query(`ALTER TABLE "personnel" DROP COLUMN "userId"`);
  }
}
