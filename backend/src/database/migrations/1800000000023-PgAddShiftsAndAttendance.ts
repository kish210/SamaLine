import { MigrationInterface, QueryRunner } from 'typeorm';

/** برنامهٔ شیفت، حضور و دفترِ یادآوری (Postgres). */
export class PgAddShiftsAndAttendance1800000000023
  implements MigrationInterface
{
  name = 'PgAddShiftsAndAttendance1800000000023';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."attendance_records_status_enum" AS ENUM('present', 'late', 'absent', 'on_leave', 'off')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."attendance_records_source_enum" AS ENUM('manual', 'bot')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."staff_reminder_log_kind_enum" AS ENUM('shift', 'tasks')`,
    );

    await queryRunner.query(
      `CREATE TABLE "shift_templates" (` +
        `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), ` +
        `"organizationId" uuid NOT NULL, ` +
        `"name" character varying(80) NOT NULL, ` +
        `"startTime" character varying(5) NOT NULL, ` +
        `"endTime" character varying(5) NOT NULL, ` +
        `"departmentId" uuid, ` +
        `"color" character varying(16) NOT NULL DEFAULT '', ` +
        `"isActive" boolean NOT NULL DEFAULT true, ` +
        `"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `"updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "PK_shift_templates" PRIMARY KEY ("id")` +
        `)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_shift_templates_org" ON "shift_templates" ("organizationId", "isActive")`,
    );

    await queryRunner.query(
      `CREATE TABLE "shift_assignments" (` +
        `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), ` +
        `"organizationId" uuid NOT NULL, ` +
        `"personnelId" uuid NOT NULL, ` +
        `"templateId" uuid, ` +
        `"date" character varying(10) NOT NULL, ` +
        `"startTime" character varying(5) NOT NULL, ` +
        `"endTime" character varying(5) NOT NULL, ` +
        `"label" character varying(80) NOT NULL DEFAULT '', ` +
        `"note" character varying(300) NOT NULL DEFAULT '', ` +
        `"reminderSentAt" TIMESTAMP WITH TIME ZONE, ` +
        `"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `"updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "PK_shift_assignments" PRIMARY KEY ("id")` +
        `)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_shift_assign_org_date" ON "shift_assignments" ("organizationId", "date")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_shift_assign_person_date" ON "shift_assignments" ("personnelId", "date")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_shift_assign_unique" ON "shift_assignments" ("organizationId", "personnelId", "date", "startTime")`,
    );

    await queryRunner.query(
      `CREATE TABLE "attendance_records" (` +
        `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), ` +
        `"organizationId" uuid NOT NULL, ` +
        `"personnelId" uuid NOT NULL, ` +
        `"date" character varying(10) NOT NULL, ` +
        `"status" "public"."attendance_records_status_enum" NOT NULL DEFAULT 'present', ` +
        `"checkIn" character varying(5) NOT NULL DEFAULT '', ` +
        `"checkOut" character varying(5) NOT NULL DEFAULT '', ` +
        `"minutesWorked" integer NOT NULL DEFAULT 0, ` +
        `"source" "public"."attendance_records_source_enum" NOT NULL DEFAULT 'manual', ` +
        `"note" character varying(300) NOT NULL DEFAULT '', ` +
        `"byUserId" uuid, ` +
        `"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `"updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "PK_attendance_records" PRIMARY KEY ("id")` +
        `)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_attendance_org_date" ON "attendance_records" ("organizationId", "date")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_attendance_unique" ON "attendance_records" ("organizationId", "personnelId", "date")`,
    );

    await queryRunner.query(
      `CREATE TABLE "staff_reminder_log" (` +
        `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), ` +
        `"organizationId" uuid NOT NULL, ` +
        `"personnelId" uuid NOT NULL, ` +
        `"kind" "public"."staff_reminder_log_kind_enum" NOT NULL, ` +
        `"forDate" character varying(10) NOT NULL, ` +
        `"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "PK_staff_reminder_log" PRIMARY KEY ("id")` +
        `)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_staff_reminder_unique" ON "staff_reminder_log" ("organizationId", "personnelId", "kind", "forDate")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_staff_reminder_unique"`);
    await queryRunner.query(`DROP TABLE "staff_reminder_log"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_attendance_unique"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_attendance_org_date"`);
    await queryRunner.query(`DROP TABLE "attendance_records"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_shift_assign_unique"`);
    await queryRunner.query(
      `DROP INDEX "public"."IDX_shift_assign_person_date"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_shift_assign_org_date"`);
    await queryRunner.query(`DROP TABLE "shift_assignments"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_shift_templates_org"`);
    await queryRunner.query(`DROP TABLE "shift_templates"`);
    await queryRunner.query(`DROP TYPE "public"."staff_reminder_log_kind_enum"`);
    await queryRunner.query(
      `DROP TYPE "public"."attendance_records_source_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."attendance_records_status_enum"`,
    );
  }
}
