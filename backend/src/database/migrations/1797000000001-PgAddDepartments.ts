import { MigrationInterface, QueryRunner } from 'typeorm';

/** نسخه‌ی Postgres بخش‌ها + عضویت بخش + ستون بخش روی فرم. */
export class PgAddDepartments1797000000001 implements MigrationInterface {
  name = 'PgAddDepartments1797000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "departments" (` +
        `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), ` +
        `"organizationId" uuid NOT NULL, ` +
        `"name" character varying(120) NOT NULL, ` +
        `"key" character varying(40) NOT NULL DEFAULT '', ` +
        `"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `"updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "PK_departments" PRIMARY KEY ("id")` +
        `)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_department_org" ON "departments" ("organizationId")`,
    );

    await queryRunner.query(
      `CREATE TABLE "department_members" (` +
        `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), ` +
        `"departmentId" uuid NOT NULL, ` +
        `"userId" uuid NOT NULL, ` +
        `"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "PK_department_members" PRIMARY KEY ("id")` +
        `)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_department_member_unique" ON "department_members" ("departmentId", "userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_department_member_user" ON "department_members" ("userId")`,
    );

    await queryRunner.query(`ALTER TABLE "forms" ADD "departmentId" uuid`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "forms" DROP COLUMN "departmentId"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_department_member_user"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_department_member_unique"`);
    await queryRunner.query(`DROP TABLE "department_members"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_department_org"`);
    await queryRunner.query(`DROP TABLE "departments"`);
  }
}
