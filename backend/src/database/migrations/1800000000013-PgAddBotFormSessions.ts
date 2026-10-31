import { MigrationInterface, QueryRunner } from 'typeorm';

/** گفتگوی پر کردنِ فرم داخلِ ربات (Postgres). */
export class PgAddBotFormSessions1800000000013 implements MigrationInterface {
  name = 'PgAddBotFormSessions1800000000013';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "bot_form_sessions" (` +
        `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), ` +
        `"chatId" character varying(64) NOT NULL, ` +
        `"platform" character varying(16) NOT NULL, ` +
        `"formId" uuid NOT NULL, ` +
        `"publicationId" uuid NOT NULL, ` +
        `"respondentKey" character varying(32) NOT NULL, ` +
        `"questionIndex" integer NOT NULL DEFAULT 0, ` +
        `"answers" jsonb NOT NULL DEFAULT '{}', ` +
        `"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `"updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "PK_bot_form_sessions" PRIMARY KEY ("id")` +
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
