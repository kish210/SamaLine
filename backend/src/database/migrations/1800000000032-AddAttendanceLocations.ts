import { MigrationInterface, QueryRunner } from 'typeorm';

/** مکان‌های مجازِ حضور (ژئوفنس) + مختصاتِ ثبتِ ربات (SQLite). */
export class AddAttendanceLocations1800000000032 implements MigrationInterface {
  name = 'AddAttendanceLocations1800000000032';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "attendance_locations" (` +
        `"id" varchar PRIMARY KEY NOT NULL, ` +
        `"organizationId" varchar NOT NULL, ` +
        `"name" varchar(120) NOT NULL, ` +
        `"lat" double precision NOT NULL, ` +
        `"lng" double precision NOT NULL, ` +
        `"radiusMeters" integer NOT NULL DEFAULT (150), ` +
        `"departmentId" varchar, ` +
        `"isActive" boolean NOT NULL DEFAULT (1), ` +
        `"createdAt" datetime NOT NULL DEFAULT (datetime('now')), ` +
        `"updatedAt" datetime NOT NULL DEFAULT (datetime('now'))` +
        `)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_attendance_locations_org" ON "attendance_locations" ("organizationId", "isActive")`,
    );

    /*
     * متنِ JSON، نه ستون‌های عددیِ جدا.
     *
     * TypeORM برای sqlite نوعِ simple-json را text ذخیره می‌کند؛ ستونِ
     * nullable است تا سطرهای موجود (و ثبتِ دستیِ مدیر) دست‌نخورده بمانند.
     */
    await queryRunner.query(
      `ALTER TABLE "attendance_records" ADD COLUMN "inLocation" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "attendance_records" ADD COLUMN "outLocation" text`,
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
