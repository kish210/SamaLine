import { MigrationInterface, QueryRunner } from 'typeorm';

/** اطلاعیهٔ سازمانیِ ماندگار (SQLite). فاز G. */
export class AddAnnouncements1800000000008 implements MigrationInterface {
  name = 'AddAnnouncements1800000000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "announcements" (` +
        `"id" varchar PRIMARY KEY NOT NULL, ` +
        `"organizationId" varchar NOT NULL, ` +
        `"departmentId" varchar, ` +
        `"title" varchar(120) NOT NULL, ` +
        `"body" text NOT NULL DEFAULT (''), ` +
        `"sentByEmail" varchar(160) NOT NULL DEFAULT (''), ` +
        `"recipientCount" integer NOT NULL DEFAULT (0), ` +
        `"createdAt" datetime NOT NULL DEFAULT (datetime('now'))` +
        `)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_announcement_org" ON "announcements" ("organizationId", "createdAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_announcement_org"`);
    await queryRunner.query(`DROP TABLE "announcements"`);
  }
}
