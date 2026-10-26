import { MigrationInterface, QueryRunner } from 'typeorm';

/** پروندهٔ پرسنل به‌عنوان داده‌ی پایهٔ HR (Postgres). فاز E. */
export class PgAddPersonnel1800000000003 implements MigrationInterface {
  name = 'PgAddPersonnel1800000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "personnel" (` +
        `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), ` +
        `"organizationId" uuid NOT NULL, ` +
        `"fullName" character varying(120) NOT NULL, ` +
        `"mobile" character varying(20) NOT NULL DEFAULT '', ` +
        `"employeeNo" character varying(40) NOT NULL DEFAULT '', ` +
        `"position" character varying(80) NOT NULL DEFAULT '', ` +
        `"departmentId" uuid, ` +
        `"hireDate" character varying(10) NOT NULL DEFAULT '', ` +
        `"documents" jsonb NOT NULL DEFAULT '[]', ` +
        `"notes" text NOT NULL DEFAULT '', ` +
        `"isActive" boolean NOT NULL DEFAULT true, ` +
        `"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `"updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "PK_personnel" PRIMARY KEY ("id")` +
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
