import { MigrationInterface, QueryRunner } from 'typeorm';

/** پروندهٔ پرسنل به‌عنوان داده‌ی پایهٔ HR (SQLite). فاز E. */
export class AddPersonnel1800000000002 implements MigrationInterface {
  name = 'AddPersonnel1800000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "personnel" (` +
        `"id" varchar PRIMARY KEY NOT NULL, ` +
        `"organizationId" varchar NOT NULL, ` +
        `"fullName" varchar(120) NOT NULL, ` +
        `"mobile" varchar(20) NOT NULL DEFAULT (''), ` +
        `"employeeNo" varchar(40) NOT NULL DEFAULT (''), ` +
        `"position" varchar(80) NOT NULL DEFAULT (''), ` +
        `"departmentId" varchar, ` +
        `"hireDate" varchar(10) NOT NULL DEFAULT (''), ` +
        `"documents" text NOT NULL DEFAULT ('[]'), ` +
        `"notes" text NOT NULL DEFAULT (''), ` +
        `"isActive" boolean NOT NULL DEFAULT (1), ` +
        `"createdAt" datetime NOT NULL DEFAULT (datetime('now')), ` +
        `"updatedAt" datetime NOT NULL DEFAULT (datetime('now'))` +
        `)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_personnel_org" ON "personnel" ("organizationId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_personnel_mobile" ON "personnel" ("organizationId", "mobile")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_personnel_mobile"`);
    await queryRunner.query(`DROP INDEX "IDX_personnel_org"`);
    await queryRunner.query(`DROP TABLE "personnel"`);
  }
}
