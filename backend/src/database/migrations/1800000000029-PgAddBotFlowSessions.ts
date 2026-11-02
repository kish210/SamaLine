import { MigrationInterface, QueryRunner } from 'typeorm';

/** گفتگوهای چندمرحله‌ایِ ربات + نوعِ تازهٔ یادآوری (Postgres). */
export class PgAddBotFlowSessions1800000000029 implements MigrationInterface {
  name = 'PgAddBotFlowSessions1800000000029';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."bot_flow_sessions_flow_enum" AS ENUM('fault', 'leave', 'letter_reply')`,
    );
    await queryRunner.query(
      `CREATE TABLE "bot_flow_sessions" (` +
        `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), ` +
        `"organizationId" uuid NOT NULL, ` +
        `"personnelId" uuid NOT NULL, ` +
        `"chatId" character varying(64) NOT NULL, ` +
        `"platform" character varying(16) NOT NULL, ` +
        `"flow" "public"."bot_flow_sessions_flow_enum" NOT NULL, ` +
        `"step" integer NOT NULL DEFAULT 0, ` +
        `"data" jsonb NOT NULL DEFAULT '{}', ` +
        `"contextId" uuid, ` +
        `"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `"updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "PK_bot_flow_sessions" PRIMARY KEY ("id")` +
        `)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_bot_flow_chat" ON "bot_flow_sessions" ("chatId", "platform")`,
    );

    // Postgres مقدارِ تازه را به خودِ نوع اضافه می‌کند؛ بازسازیِ جدول لازم نیست.
    await queryRunner.query(
      `ALTER TYPE "public"."staff_reminder_log_kind_enum" ADD VALUE IF NOT EXISTS 'letters'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_bot_flow_chat"`);
    await queryRunner.query(`DROP TABLE "bot_flow_sessions"`);
    await queryRunner.query(`DROP TYPE "public"."bot_flow_sessions_flow_enum"`);
    /*
     * مقدارِ enum در Postgres حذف‌شدنی نیست؛ سطرهایش پاک می‌شوند و خودِ
     * مقدار بی‌استفاده می‌ماند. برگرداندنِ نوع یعنی بازسازیِ کلِ ستون، که
     * ریسکش از سودش بیشتر است.
     */
    await queryRunner.query(
      `DELETE FROM "staff_reminder_log" WHERE "kind" = 'letters'`,
    );
  }
}
