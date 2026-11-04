import { MigrationInterface, QueryRunner } from 'typeorm';

/** مکان‌های مجازِ حضور (ژئوفنس) + مختصاتِ ثبتِ ربات (Postgres). */
export class PgAddAttendanceLocations1800000000033 implements MigrationInterface {
  name = 'PgAddAttendanceLocations1800000000033';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "attendance_locations" (` +
        `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), ` +
        `"organizationId" uuid NOT NULL, ` +
        `"name" character varying(120) NOT NULL, ` +
        `"lat" double precision NOT NULL, ` +
        `"lng" double precision NOT NULL, ` +
        `"radiusMeters" integer NOT NULL DEFAULT 150, ` +
        `"departmentId" uuid, ` +
        `"isActive" boolean NOT NULL DEFAULT true, ` +
        `"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `"updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "PK_attendance_locations" PRIMARY KEY ("id")` +
        `)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_attendance_locations_org" ON "attendance_locations" ("organizationId", "isActive")`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendance_records" ADD "inLocation" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendance_records" ADD "outLocation" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "attendance_records" DROP COLUMN "outLocation"`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendance_records" DROP COLUMN "inLocation"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_attendance_locations_org"`);
    await queryRunner.query(`DROP TABLE "attendance_locations"`);
  }
}
