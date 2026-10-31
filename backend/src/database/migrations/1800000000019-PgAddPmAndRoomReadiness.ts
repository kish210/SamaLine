import { MigrationInterface, QueryRunner } from 'typeorm';

/** نگهداریِ پیشگیرانه + وضعیتِ آمادگیِ اتاق (Postgres). */
export class PgAddPmAndRoomReadiness1800000000019
  implements MigrationInterface
{
  name = 'PgAddPmAndRoomReadiness1800000000019';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."pm_schedules_category_enum" AS ENUM('electrical', 'plumbing', 'hvac', 'carpentry', 'painting', 'furniture', 'network', 'door_lock', 'other')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."pm_schedules_interval_enum" AS ENUM('daily', 'weekly', 'monthly', 'quarterly', 'annual', 'custom')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."hotel_rooms_readiness_enum" AS ENUM('ready', 'under_maintenance', 'out_of_service', 'awaiting_inspection', 'repaired_awaiting_approval')`,
    );

    await queryRunner.query(
      `CREATE TABLE "pm_schedules" (` +
        `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), ` +
        `"organizationId" uuid NOT NULL, ` +
        `"title" character varying(200) NOT NULL, ` +
        `"assetId" uuid, ` +
        `"roomId" uuid, ` +
        `"departmentId" uuid, ` +
        `"category" "public"."pm_schedules_category_enum" NOT NULL DEFAULT 'other', ` +
        `"interval" "public"."pm_schedules_interval_enum" NOT NULL DEFAULT 'monthly', ` +
        `"intervalDays" integer NOT NULL DEFAULT 0, ` +
        `"checklist" jsonb NOT NULL DEFAULT '[]', ` +
        `"technicianIds" jsonb NOT NULL DEFAULT '[]', ` +
        `"instructions" text NOT NULL DEFAULT '', ` +
        `"nextDueAt" character varying(10) NOT NULL, ` +
        `"lastGeneratedAt" TIMESTAMP WITH TIME ZONE, ` +
        `"lastWorkOrderId" uuid, ` +
        `"isActive" boolean NOT NULL DEFAULT true, ` +
        `"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `"updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "PK_pm_schedules" PRIMARY KEY ("id")` +
        `)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pm_org_active" ON "pm_schedules" ("organizationId", "isActive")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_pm_next_due" ON "pm_schedules" ("nextDueAt")`,
    );

    await queryRunner.query(
      `ALTER TABLE "hotel_rooms" ADD "readiness" "public"."hotel_rooms_readiness_enum" NOT NULL DEFAULT 'ready'`,
    );
    await queryRunner.query(
      `ALTER TABLE "hotel_rooms" ADD "readinessNote" character varying(200) NOT NULL DEFAULT ''`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "hotel_rooms" DROP COLUMN "readinessNote"`,
    );
    await queryRunner.query(`ALTER TABLE "hotel_rooms" DROP COLUMN "readiness"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_pm_next_due"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_pm_org_active"`);
    await queryRunner.query(`DROP TABLE "pm_schedules"`);
    await queryRunner.query(`DROP TYPE "public"."hotel_rooms_readiness_enum"`);
    await queryRunner.query(`DROP TYPE "public"."pm_schedules_interval_enum"`);
    await queryRunner.query(`DROP TYPE "public"."pm_schedules_category_enum"`);
  }
}
