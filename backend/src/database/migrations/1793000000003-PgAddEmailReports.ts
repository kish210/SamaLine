import { MigrationInterface, QueryRunner } from 'typeorm';

/** نسخه‌ی Postgres جدول گیرندگان گزارش دوره‌ای ایمیلی. */
export class PgAddEmailReports1793000000003 implements MigrationInterface {
  name = 'PgAddEmailReports1793000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "email_report_recipients" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" uuid NOT NULL, "formId" uuid, "email" character varying(160) NOT NULL, "label" character varying(120) NOT NULL DEFAULT '', "digest" character varying(16) NOT NULL DEFAULT 'weekly', "isActive" boolean NOT NULL DEFAULT true, "lastDigestAt" TIMESTAMP WITH TIME ZONE, "lastError" character varying(300), "lastSentAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_email_report_recipients" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_email_report_ws_form" ON "email_report_recipients" ("workspaceId", "formId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_email_report_ws_form"`);
    await queryRunner.query(`DROP TABLE "email_report_recipients"`);
  }
}
