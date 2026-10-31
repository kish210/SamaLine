import { MigrationInterface, QueryRunner } from 'typeorm';

const CATEGORY = `'electrical', 'plumbing', 'hvac', 'carpentry', 'painting', 'furniture', 'network', 'door_lock', 'other'`;
const PM_INTERVAL = `'daily', 'weekly', 'monthly', 'quarterly', 'annual', 'custom'`;
const READINESS = `'ready', 'under_maintenance', 'out_of_service', 'awaiting_inspection', 'repaired_awaiting_approval'`;

/** نگهداریِ پیشگیرانه + وضعیتِ آمادگیِ اتاق (SQLite). */
export class AddPmAndRoomReadiness1800000000018 implements MigrationInterface {
  name = 'AddPmAndRoomReadiness1800000000018';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "pm_schedules" (` +
        `"id" varchar PRIMARY KEY NOT NULL, ` +
        `"organizationId" varchar NOT NULL, ` +
        `"title" varchar(200) NOT NULL, ` +
        `"assetId" varchar, ` +
        `"roomId" varchar, ` +
        `"departmentId" varchar, ` +
        `"category" varchar CHECK( "category" IN (${CATEGORY}) ) NOT NULL DEFAULT ('other'), ` +
        `"interval" varchar CHECK( "interval" IN (${PM_INTERVAL}) ) NOT NULL DEFAULT ('monthly'), ` +
        `"intervalDays" integer NOT NULL DEFAULT (0), ` +
        `"checklist" text NOT NULL DEFAULT ('[]'), ` +
        `"technicianIds" text NOT NULL DEFAULT ('[]'), ` +
        `"instructions" text NOT NULL DEFAULT (''), ` +
        `"nextDueAt" varchar(10) NOT NULL, ` +
        `"lastGeneratedAt" datetime, ` +
        `"lastWorkOrderId" varchar, ` +
        `"isActive" boolean NOT NULL DEFAULT (1), ` +
        `"createdAt" datetime NOT NULL DEFAULT (datetime('now')), ` +
        `"updatedAt" datetime NOT NULL DEFAULT (datetime('now'))` +
        `)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pm_org_active" ON "pm_schedules" ("organizationId", "isActive")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pm_next_due" ON "pm_schedules" ("nextDueAt")`,
    );

    // وضعیتِ آمادگیِ اتاق؛ ستون‌ها جدا اضافه می‌شوند تا جدول بازسازی نشود.
    await queryRunner.query(
      `ALTER TABLE "hotel_rooms" ADD COLUMN "readiness" varchar CHECK( "readiness" IN (${READINESS}) ) NOT NULL DEFAULT ('ready')`,
    );
    await queryRunner.query(
      `ALTER TABLE "hotel_rooms" ADD COLUMN "readinessNote" varchar(200) NOT NULL DEFAULT ('')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "hotel_rooms" DROP COLUMN "readinessNote"`,
    );
    await queryRunner.query(`ALTER TABLE "hotel_rooms" DROP COLUMN "readiness"`);
    await queryRunner.query(`DROP INDEX "IDX_pm_next_due"`);
    await queryRunner.query(`DROP INDEX "IDX_pm_org_active"`);
    await queryRunner.query(`DROP TABLE "pm_schedules"`);
  }
}
