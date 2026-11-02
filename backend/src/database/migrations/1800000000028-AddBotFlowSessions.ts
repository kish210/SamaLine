import { MigrationInterface, QueryRunner } from 'typeorm';

const FLOW = `'fault', 'leave', 'letter_reply'`;
const REMINDER_KIND = `'shift', 'tasks', 'letters'`;

/** گفتگوهای چندمرحله‌ایِ ربات + نوعِ تازهٔ یادآوری (SQLite). */
export class AddBotFlowSessions1800000000028 implements MigrationInterface {
  name = 'AddBotFlowSessions1800000000028';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "bot_flow_sessions" (` +
        `"id" varchar PRIMARY KEY NOT NULL, ` +
        `"organizationId" varchar NOT NULL, ` +
        `"personnelId" varchar NOT NULL, ` +
        `"chatId" varchar(64) NOT NULL, ` +
        `"platform" varchar(16) NOT NULL, ` +
        `"flow" varchar CHECK( "flow" IN (${FLOW}) ) NOT NULL, ` +
        `"step" integer NOT NULL DEFAULT (0), ` +
        `"data" text NOT NULL DEFAULT ('{}'), ` +
        `"contextId" varchar, ` +
        `"createdAt" datetime NOT NULL DEFAULT (datetime('now')), ` +
        `"updatedAt" datetime NOT NULL DEFAULT (datetime('now'))` +
        `)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_bot_flow_chat" ON "bot_flow_sessions" ("chatId", "platform")`,
    );

    /*
     * «نامهٔ نخوانده» نوعِ تازهٔ یادآوری است.
     *
     * SQLite نوعِ CHECK را درجا عوض نمی‌کند، پس جدولِ دفترِ یادآوری با
     * قیدِ تازه بازساخته و داده‌اش منتقل می‌شود. جدول کوچک است و فقط
     * نشانهٔ «قبلاً فرستادیم» را نگه می‌دارد.
     */
    await queryRunner.query(
      `CREATE TABLE "staff_reminder_log_new" (` +
        `"id" varchar PRIMARY KEY NOT NULL, ` +
        `"organizationId" varchar NOT NULL, ` +
        `"personnelId" varchar NOT NULL, ` +
        `"kind" varchar CHECK( "kind" IN (${REMINDER_KIND}) ) NOT NULL, ` +
        `"forDate" varchar(10) NOT NULL, ` +
        `"createdAt" datetime NOT NULL DEFAULT (datetime('now'))` +
        `)`,
    );
    await queryRunner.query(
      `INSERT INTO "staff_reminder_log_new" ("id", "organizationId", "personnelId", "kind", "forDate", "createdAt") ` +
        `SELECT "id", "organizationId", "personnelId", "kind", "forDate", "createdAt" FROM "staff_reminder_log"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_staff_reminder_unique"`);
    await queryRunner.query(`DROP TABLE "staff_reminder_log"`);
    await queryRunner.query(
      `ALTER TABLE "staff_reminder_log_new" RENAME TO "staff_reminder_log"`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_staff_reminder_unique" ON "staff_reminder_log" ("organizationId", "personnelId", "kind", "forDate")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_bot_flow_chat"`);
    await queryRunner.query(`DROP TABLE "bot_flow_sessions"`);
    // نوعِ «letters» برگردانده نمی‌شود؛ سطرهایش با قیدِ قبلی نمی‌خوانند.
    await queryRunner.query(
      `DELETE FROM "staff_reminder_log" WHERE "kind" = 'letters'`,
    );
  }
}
