import { MigrationInterface, QueryRunner } from 'typeorm';

/** دامنهٔ HR: مرخصی، ماندهٔ مرخصی و وضعیتِ اشتغال/قرارداد (Postgres). */
export class PgAddHrDomain1800000000017 implements MigrationInterface {
  name = 'PgAddHrDomain1800000000017';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."leave_requests_type_enum" AS ENUM('annual', 'sick', 'unpaid', 'mission', 'hourly', 'other')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."leave_requests_status_enum" AS ENUM('pending', 'approved', 'rejected', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."leave_balances_type_enum" AS ENUM('annual', 'sick', 'unpaid', 'mission', 'hourly', 'other')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."personnel_employmentstatus_enum" AS ENUM('active', 'on_leave', 'suspended', 'terminated')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."personnel_contracttype_enum" AS ENUM('full_time', 'part_time', 'contract', 'temporary', 'probation')`,
    );

    await queryRunner.query(
      `CREATE TABLE "leave_requests" (` +
        `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), ` +
        `"organizationId" uuid NOT NULL, ` +
        `"number" character varying(24) NOT NULL, ` +
        `"personnelId" uuid NOT NULL, ` +
        `"departmentId" uuid, ` +
        `"type" "public"."leave_requests_type_enum" NOT NULL DEFAULT 'annual', ` +
        `"fromDate" character varying(10) NOT NULL, ` +
        `"toDate" character varying(10) NOT NULL, ` +
        `"days" double precision NOT NULL DEFAULT 0, ` +
        `"reason" text NOT NULL DEFAULT '', ` +
        `"status" "public"."leave_requests_status_enum" NOT NULL DEFAULT 'pending', ` +
        `"decidedByUserId" uuid, ` +
        `"decidedAt" TIMESTAMP WITH TIME ZONE, ` +
        `"decisionNote" text NOT NULL DEFAULT '', ` +
        `"history" jsonb NOT NULL DEFAULT '[]', ` +
        `"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `"updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "PK_leave_requests" PRIMARY KEY ("id")` +
        `)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_leave_org_status" ON "leave_requests" ("organizationId", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_leave_person" ON "leave_requests" ("personnelId")`,
    );

    await queryRunner.query(
      `CREATE TABLE "leave_balances" (` +
        `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), ` +
        `"organizationId" uuid NOT NULL, ` +
        `"personnelId" uuid NOT NULL, ` +
        `"year" integer NOT NULL, ` +
        `"type" "public"."leave_balances_type_enum" NOT NULL DEFAULT 'annual', ` +
        `"entitledDays" double precision NOT NULL DEFAULT 0, ` +
        `"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `"updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "PK_leave_balances" PRIMARY KEY ("id")` +
        `)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_leave_balance_unique" ON "leave_balances" ("personnelId", "year", "type")`,
    );

    await queryRunner.query(
      `ALTER TABLE "personnel" ADD "employmentStatus" "public"."personnel_employmentstatus_enum" NOT NULL DEFAULT 'active'`,
    );
    await queryRunner.query(
      `ALTER TABLE "personnel" ADD "contractType" "public"."personnel_contracttype_enum" NOT NULL DEFAULT 'full_time'`,
    );
    await queryRunner.query(
      `ALTER TABLE "personnel" ADD "contractEndsAt" character varying(10) NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `ALTER TABLE "personnel" ADD "terminatedAt" character varying(10) NOT NULL DEFAULT ''`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "personnel" DROP COLUMN "terminatedAt"`);
    await queryRunner.query(
      `ALTER TABLE "personnel" DROP COLUMN "contractEndsAt"`,
    );
    await queryRunner.query(`ALTER TABLE "personnel" DROP COLUMN "contractType"`);
    await queryRunner.query(
      `ALTER TABLE "personnel" DROP COLUMN "employmentStatus"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_leave_balance_unique"`);
    await queryRunner.query(`DROP TABLE "leave_balances"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_leave_person"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_leave_org_status"`);
    await queryRunner.query(`DROP TABLE "leave_requests"`);
    await queryRunner.query(`DROP TYPE "public"."personnel_contracttype_enum"`);
    await queryRunner.query(
      `DROP TYPE "public"."personnel_employmentstatus_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."leave_balances_type_enum"`);
    await queryRunner.query(`DROP TYPE "public"."leave_requests_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."leave_requests_type_enum"`);
  }
}
