import { MigrationInterface, QueryRunner } from 'typeorm';

/** جدول گیرندگان گزارش دوره‌ای ایمیلی (SQLite). */
export class AddEmailReports1793000000002 implements MigrationInterface {
  name = 'AddEmailReports1793000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "email_report_recipients" ("id" varchar PRIMARY KEY NOT NULL, "workspaceId" varchar NOT NULL, "formId" varchar, "email" varchar(160) NOT NULL, "label" varchar(120) NOT NULL DEFAULT (''), "digest" varchar(16) NOT NULL DEFAULT ('weekly'), "isActive" boolean NOT NULL DEFAULT (1), "lastDigestAt" datetime, "lastError" varchar(300), "lastSentAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')))`,
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
