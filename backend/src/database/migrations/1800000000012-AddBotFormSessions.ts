import { MigrationInterface, QueryRunner } from 'typeorm';

/** گفتگوی پر کردنِ فرم داخلِ ربات (SQLite). */
export class AddBotFormSessions1800000000012 implements MigrationInterface {
  name = 'AddBotFormSessions1800000000012';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "bot_form_sessions" (` +
        `"id" varchar PRIMARY KEY NOT NULL, ` +
        `"chatId" varchar(64) NOT NULL, ` +
        `"platform" varchar(16) NOT NULL, ` +
        `"formId" varchar NOT NULL, ` +
        `"publicationId" varchar NOT NULL, ` +
        `"respondentKey" varchar(32) NOT NULL, ` +
        `"questionIndex" integer NOT NULL DEFAULT (0), ` +
        `"answers" text NOT NULL DEFAULT ('{}'), ` +
        `"createdAt" datetime NOT NULL DEFAULT (datetime('now')), ` +
        `"updatedAt" datetime NOT NULL DEFAULT (datetime('now'))` +
        `)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_bot_form_sessions_chat" ON "bot_form_sessions" ("chatId", "platform")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_bot_form_sessions_chat"`);
    await queryRunner.query(`DROP TABLE "bot_form_sessions"`);
  }
}
