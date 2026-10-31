import { MigrationInterface, QueryRunner } from 'typeorm';

const ATT_STATUS = `'present', 'late', 'absent', 'on_leave', 'off'`;
const ATT_SOURCE = `'manual', 'bot'`;
const REMINDER_KIND = `'shift', 'tasks'`;

/** برنامهٔ شیفت، حضور و دفترِ یادآوری (SQLite). */
export class AddShiftsAndAttendance1800000000022 implements MigrationInterface {
  name = 'AddShiftsAndAttendance1800000000022';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "shift_templates" (` +
        `"id" varchar PRIMARY KEY NOT NULL, ` +
        `"organizationId" varchar NOT NULL, ` +
        `"name" varchar(80) NOT NULL, ` +
        `"startTime" varchar(5) NOT NULL, ` +
        `"endTime" varchar(5) NOT NULL, ` +
        `"departmentId" varchar, ` +
        `"color" varchar(16) NOT NULL DEFAULT (''), ` +
        `"isActive" boolean NOT NULL DEFAULT (1), ` +
        `"createdAt" datetime NOT NULL DEFAULT (datetime('now')), ` +
        `"updatedAt" datetime NOT NULL DEFAULT (datetime('now'))` +
        `)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_shift_templates_org" ON "shift_templates" ("organizationId", "isActive")`,
    );

    await queryRunner.query(
      `CREATE TABLE "shift_assignments" (` +
        `"id" varchar PRIMARY KEY NOT NULL, ` +
        `"organizationId" varchar NOT NULL, ` +
        `"personnelId" varchar NOT NULL, ` +
        `"templateId" varchar, ` +
        `"date" varchar(10) NOT NULL, ` +
        `"startTime" varchar(5) NOT NULL, ` +
        `"endTime" varchar(5) NOT NULL, ` +
        `"label" varchar(80) NOT NULL DEFAULT (''), ` +
        `"note" varchar(300) NOT NULL DEFAULT (''), ` +
        `"reminderSentAt" datetime, ` +
        `"createdAt" datetime NOT NULL DEFAULT (datetime('now')), ` +
        `"updatedAt" datetime NOT NULL DEFAULT (datetime('now'))` +
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
        `"id" varchar PRIMARY KEY NOT NULL, ` +
        `"organizationId" varchar NOT NULL, ` +
        `"personnelId" varchar NOT NULL, ` +
        `"date" varchar(10) NOT NULL, ` +
        `"status" varchar CHECK( "status" IN (${ATT_STATUS}) ) NOT NULL DEFAULT ('present'), ` +
        `"checkIn" varchar(5) NOT NULL DEFAULT (''), ` +
        `"checkOut" varchar(5) NOT NULL DEFAULT (''), ` +
        `"minutesWorked" integer NOT NULL DEFAULT (0), ` +
        `"source" varchar CHECK( "source" IN (${ATT_SOURCE}) ) NOT NULL DEFAULT ('manual'), ` +
        `"note" varchar(300) NOT NULL DEFAULT (''), ` +
        `"byUserId" varchar, ` +
        `"createdAt" datetime NOT NULL DEFAULT (datetime('now')), ` +
        `"updatedAt" datetime NOT NULL DEFAULT (datetime('now'))` +
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
        `"id" varchar PRIMARY KEY NOT NULL, ` +
        `"organizationId" varchar NOT NULL, ` +
        `"personnelId" varchar NOT NULL, ` +
        `"kind" varchar CHECK( "kind" IN (${REMINDER_KIND}) ) NOT NULL, ` +
        `"forDate" varchar(10) NOT NULL, ` +
        `"createdAt" datetime NOT NULL DEFAULT (datetime('now'))` +
        `)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_staff_reminder_unique" ON "staff_reminder_log" ("organizationId", "personnelId", "kind", "forDate")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_staff_reminder_unique"`);
    await queryRunner.query(`DROP TABLE "staff_reminder_log"`);
    await queryRunner.query(`DROP INDEX "IDX_attendance_unique"`);
    await queryRunner.query(`DROP INDEX "IDX_attendance_org_date"`);
    await queryRunner.query(`DROP TABLE "attendance_records"`);
    await queryRunner.query(`DROP INDEX "IDX_shift_assign_unique"`);
    await queryRunner.query(`DROP INDEX "IDX_shift_assign_person_date"`);
    await queryRunner.query(`DROP INDEX "IDX_shift_assign_org_date"`);
    await queryRunner.query(`DROP TABLE "shift_assignments"`);
    await queryRunner.query(`DROP INDEX "IDX_shift_templates_org"`);
    await queryRunner.query(`DROP TABLE "shift_templates"`);
  }
}
