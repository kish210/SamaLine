import { MigrationInterface, QueryRunner } from 'typeorm';

/** بخش‌ها + عضویت بخش + ستون بخش روی فرم (SQLite). فاز A پلتفرم عملیات هتل. */
export class AddDepartments1797000000000 implements MigrationInterface {
  name = 'AddDepartments1797000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "departments" (` +
        `"id" varchar PRIMARY KEY NOT NULL, ` +
        `"organizationId" varchar NOT NULL, ` +
        `"name" varchar(120) NOT NULL, ` +
        `"key" varchar(40) NOT NULL DEFAULT (''), ` +
        `"createdAt" datetime NOT NULL DEFAULT (datetime('now')), ` +
        `"updatedAt" datetime NOT NULL DEFAULT (datetime('now'))` +
        `)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_department_org" ON "departments" ("organizationId")`,
    );

    await queryRunner.query(
      `CREATE TABLE "department_members" (` +
        `"id" varchar PRIMARY KEY NOT NULL, ` +
        `"departmentId" varchar NOT NULL, ` +
        `"userId" varchar NOT NULL, ` +
        `"createdAt" datetime NOT NULL DEFAULT (datetime('now'))` +
        `)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_department_member_unique" ON "department_members" ("departmentId", "userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_department_member_user" ON "department_members" ("userId")`,
    );

    await queryRunner.query(`ALTER TABLE "forms" ADD COLUMN "departmentId" varchar`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "forms" DROP COLUMN "departmentId"`);
    await queryRunner.query(`DROP INDEX "IDX_department_member_user"`);
    await queryRunner.query(`DROP INDEX "IDX_department_member_unique"`);
    await queryRunner.query(`DROP TABLE "department_members"`);
    await queryRunner.query(`DROP INDEX "IDX_department_org"`);
    await queryRunner.query(`DROP TABLE "departments"`);
  }
}
