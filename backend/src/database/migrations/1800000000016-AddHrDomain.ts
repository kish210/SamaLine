import { MigrationInterface, QueryRunner } from 'typeorm';

const LEAVE_TYPE = `'annual', 'sick', 'unpaid', 'mission', 'hourly', 'other'`;
const LEAVE_STATUS = `'pending', 'approved', 'rejected', 'cancelled'`;
const EMPLOYMENT = `'active', 'on_leave', 'suspended', 'terminated'`;
const CONTRACT = `'full_time', 'part_time', 'contract', 'temporary', 'probation'`;

/** دامنهٔ HR: مرخصی، ماندهٔ مرخصی و وضعیتِ اشتغال/قرارداد (SQLite). */
export class AddHrDomain1800000000016 implements MigrationInterface {
  name = 'AddHrDomain1800000000016';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "leave_requests" (` +
        `"id" varchar PRIMARY KEY NOT NULL, ` +
        `"organizationId" varchar NOT NULL, ` +
        `"number" varchar(24) NOT NULL, ` +
        `"personnelId" varchar NOT NULL, ` +
        `"departmentId" varchar, ` +
        `"type" varchar CHECK( "type" IN (${LEAVE_TYPE}) ) NOT NULL DEFAULT ('annual'), ` +
        `"fromDate" varchar(10) NOT NULL, ` +
        `"toDate" varchar(10) NOT NULL, ` +
        `"days" float NOT NULL DEFAULT (0), ` +
        `"reason" text NOT NULL DEFAULT (''), ` +
        `"status" varchar CHECK( "status" IN (${LEAVE_STATUS}) ) NOT NULL DEFAULT ('pending'), ` +
        `"decidedByUserId" varchar, ` +
        `"decidedAt" datetime, ` +
        `"decisionNote" text NOT NULL DEFAULT (''), ` +
        `"history" text NOT NULL DEFAULT ('[]'), ` +
        `"createdAt" datetime NOT NULL DEFAULT (datetime('now')), ` +
        `"updatedAt" datetime NOT NULL DEFAULT (datetime('now'))` +
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
        `"id" varchar PRIMARY KEY NOT NULL, ` +
        `"organizationId" varchar NOT NULL, ` +
        `"personnelId" varchar NOT NULL, ` +
        `"year" integer NOT NULL, ` +
        `"type" varchar CHECK( "type" IN (${LEAVE_TYPE}) ) NOT NULL DEFAULT ('annual'), ` +
        `"entitledDays" float NOT NULL DEFAULT (0), ` +
        `"createdAt" datetime NOT NULL DEFAULT (datetime('now')), ` +
        `"updatedAt" datetime NOT NULL DEFAULT (datetime('now'))` +
        `)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_leave_balance_unique" ON "leave_balances" ("personnelId", "year", "type")`,
    );

    /*
     * ستون‌های تازه‌ی پرسنل.
     *
     * SQLite فقط ALTER TABLE ADD COLUMN را ساده می‌پذیرد؛ هر ستون جدا اضافه
     * می‌شود تا جدول بازسازی نشود و داده‌ی موجود دست‌نخورده بماند.
     */
    await queryRunner.query(
      `ALTER TABLE "personnel" ADD COLUMN "employmentStatus" varchar CHECK( "employmentStatus" IN (${EMPLOYMENT}) ) NOT NULL DEFAULT ('active')`,
    );
    await queryRunner.query(
      `ALTER TABLE "personnel" ADD COLUMN "contractType" varchar CHECK( "contractType" IN (${CONTRACT}) ) NOT NULL DEFAULT ('full_time')`,
    );
    await queryRunner.query(
      `ALTER TABLE "personnel" ADD COLUMN "contractEndsAt" varchar(10) NOT NULL DEFAULT ('')`,
    );
    await queryRunner.query(
      `ALTER TABLE "personnel" ADD COLUMN "terminatedAt" varchar(10) NOT NULL DEFAULT ('')`,
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
    await queryRunner.query(`DROP INDEX "IDX_leave_balance_unique"`);
    await queryRunner.query(`DROP TABLE "leave_balances"`);
    await queryRunner.query(`DROP INDEX "IDX_leave_person"`);
    await queryRunner.query(`DROP INDEX "IDX_leave_org_status"`);
    await queryRunner.query(`DROP TABLE "leave_requests"`);
  }
}
