import { MigrationInterface, QueryRunner } from 'typeorm';

/** اطلاعیهٔ سازمانیِ ماندگار (Postgres). فاز G. */
export class PgAddAnnouncements1800000000009 implements MigrationInterface {
  name = 'PgAddAnnouncements1800000000009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "announcements" (` +
        `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), ` +
        `"organizationId" uuid NOT NULL, ` +
        `"departmentId" uuid, ` +
        `"title" character varying(120) NOT NULL, ` +
        `"body" text NOT NULL DEFAULT '', ` +
        `"sentByEmail" character varying(160) NOT NULL DEFAULT '', ` +
        `"recipientCount" integer NOT NULL DEFAULT 0, ` +
        `"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "PK_announcements" PRIMARY KEY ("id")` +
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
