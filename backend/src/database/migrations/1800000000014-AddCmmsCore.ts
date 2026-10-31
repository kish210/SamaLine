import { MigrationInterface, QueryRunner } from 'typeorm';

const CRITICALITY = `'low', 'medium', 'high', 'critical'`;
const ASSET_STATUS = `'operational', 'under_maintenance', 'out_of_service', 'retired'`;
const CATEGORY = `'electrical', 'plumbing', 'hvac', 'carpentry', 'painting', 'furniture', 'network', 'door_lock', 'other'`;
const PRIORITY = `'low', 'normal', 'high', 'emergency'`;
const REQ_STATUS = `'new', 'under_review', 'approved', 'assigned', 'in_progress', 'waiting_parts', 'waiting_contractor', 'follow_up', 'completed', 'rejected', 'closed'`;
const WO_STATUS = `'draft', 'assigned', 'in_progress', 'waiting_parts', 'waiting_contractor', 'completed', 'verified', 'closed', 'cancelled'`;

/** پایهٔ CMMS: دارایی، درخواستِ تعمیر، دستورِ کار و تکنسین‌ها (SQLite). */
export class AddCmmsCore1800000000014 implements MigrationInterface {
  name = 'AddCmmsCore1800000000014';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "assets" (` +
        `"id" varchar PRIMARY KEY NOT NULL, ` +
        `"organizationId" varchar NOT NULL, ` +
        `"code" varchar(40) NOT NULL, ` +
        `"name" varchar(160) NOT NULL, ` +
        `"category" varchar(80) NOT NULL DEFAULT (''), ` +
        `"manufacturer" varchar(120) NOT NULL DEFAULT (''), ` +
        `"model" varchar(120) NOT NULL DEFAULT (''), ` +
        `"serialNumber" varchar(120) NOT NULL DEFAULT (''), ` +
        `"location" varchar(160) NOT NULL DEFAULT (''), ` +
        `"building" varchar(80) NOT NULL DEFAULT (''), ` +
        `"floor" varchar(40) NOT NULL DEFAULT (''), ` +
        `"roomId" varchar, ` +
        `"departmentId" varchar, ` +
        `"parentId" varchar, ` +
        `"installedAt" varchar(10) NOT NULL DEFAULT (''), ` +
        `"warrantyUntil" varchar(10) NOT NULL DEFAULT (''), ` +
        `"criticality" varchar CHECK( "criticality" IN (${CRITICALITY}) ) NOT NULL DEFAULT ('medium'), ` +
        `"status" varchar CHECK( "status" IN (${ASSET_STATUS}) ) NOT NULL DEFAULT ('operational'), ` +
        `"documents" text NOT NULL DEFAULT ('[]'), ` +
        `"notes" text NOT NULL DEFAULT (''), ` +
        `"createdAt" datetime NOT NULL DEFAULT (datetime('now')), ` +
        `"updatedAt" datetime NOT NULL DEFAULT (datetime('now'))` +
        `)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_assets_org_status" ON "assets" ("organizationId", "status")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_assets_org_code" ON "assets" ("organizationId", "code")`,
    );

    await queryRunner.query(
      `CREATE TABLE "maintenance_requests" (` +
        `"id" varchar PRIMARY KEY NOT NULL, ` +
        `"organizationId" varchar NOT NULL, ` +
        `"number" varchar(24) NOT NULL, ` +
        `"requestedByUserId" varchar, ` +
        `"requestedByPersonnelId" varchar, ` +
        `"departmentId" varchar, ` +
        `"roomId" varchar, ` +
        `"assetId" varchar, ` +
        `"location" varchar(160) NOT NULL DEFAULT (''), ` +
        `"title" varchar(200) NOT NULL, ` +
        `"description" text NOT NULL DEFAULT (''), ` +
        `"category" varchar CHECK( "category" IN (${CATEGORY}) ) NOT NULL DEFAULT ('other'), ` +
        `"priority" varchar CHECK( "priority" IN (${PRIORITY}) ) NOT NULL DEFAULT ('normal'), ` +
        `"status" varchar CHECK( "status" IN (${REQ_STATUS}) ) NOT NULL DEFAULT ('new'), ` +
        `"attachments" text NOT NULL DEFAULT ('[]'), ` +
        `"operationalImpact" varchar(200) NOT NULL DEFAULT (''), ` +
        `"guestRelated" boolean NOT NULL DEFAULT (0), ` +
        `"dueDate" varchar(10) NOT NULL DEFAULT (''), ` +
        `"rejectionReason" text NOT NULL DEFAULT (''), ` +
        `"history" text NOT NULL DEFAULT ('[]'), ` +
        `"completedAt" datetime, ` +
        `"createdAt" datetime NOT NULL DEFAULT (datetime('now')), ` +
        `"updatedAt" datetime NOT NULL DEFAULT (datetime('now'))` +
        `)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_maint_req_org_status" ON "maintenance_requests" ("organizationId", "status")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_maint_req_org_number" ON "maintenance_requests" ("organizationId", "number")`,
    );

    await queryRunner.query(
      `CREATE TABLE "work_orders" (` +
        `"id" varchar PRIMARY KEY NOT NULL, ` +
        `"organizationId" varchar NOT NULL, ` +
        `"number" varchar(24) NOT NULL, ` +
        `"requestId" varchar, ` +
        `"assetId" varchar, ` +
        `"roomId" varchar, ` +
        `"departmentId" varchar, ` +
        `"title" varchar(200) NOT NULL, ` +
        `"category" varchar CHECK( "category" IN (${CATEGORY}) ) NOT NULL DEFAULT ('other'), ` +
        `"priority" varchar CHECK( "priority" IN (${PRIORITY}) ) NOT NULL DEFAULT ('normal'), ` +
        `"status" varchar CHECK( "status" IN (${WO_STATUS}) ) NOT NULL DEFAULT ('draft'), ` +
        `"diagnosis" text NOT NULL DEFAULT (''), ` +
        `"rootCause" text NOT NULL DEFAULT (''), ` +
        `"workDescription" text NOT NULL DEFAULT (''), ` +
        `"workPerformed" text NOT NULL DEFAULT (''), ` +
        `"technicianNotes" text NOT NULL DEFAULT (''), ` +
        `"parts" text NOT NULL DEFAULT ('[]'), ` +
        `"laborMinutes" integer NOT NULL DEFAULT (0), ` +
        `"internalCost" integer NOT NULL DEFAULT (0), ` +
        `"contractorCost" integer NOT NULL DEFAULT (0), ` +
        `"attachments" text NOT NULL DEFAULT ('[]'), ` +
        `"checklist" text NOT NULL DEFAULT ('[]'), ` +
        `"startedAt" datetime, ` +
        `"completedAt" datetime, ` +
        `"verifiedByUserId" varchar, ` +
        `"verifiedAt" datetime, ` +
        `"dueDate" varchar(10) NOT NULL DEFAULT (''), ` +
        `"history" text NOT NULL DEFAULT ('[]'), ` +
        `"createdAt" datetime NOT NULL DEFAULT (datetime('now')), ` +
        `"updatedAt" datetime NOT NULL DEFAULT (datetime('now'))` +
        `)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_work_orders_org_status" ON "work_orders" ("organizationId", "status")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_work_orders_org_number" ON "work_orders" ("organizationId", "number")`,
    );

    await queryRunner.query(
      `CREATE TABLE "work_order_technicians" (` +
        `"id" varchar PRIMARY KEY NOT NULL, ` +
        `"workOrderId" varchar NOT NULL, ` +
        `"personnelId" varchar NOT NULL, ` +
        `"isPrimary" boolean NOT NULL DEFAULT (0), ` +
        `"laborMinutes" integer NOT NULL DEFAULT (0), ` +
        `"createdAt" datetime NOT NULL DEFAULT (datetime('now'))` +
        `)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_wo_tech_order" ON "work_order_technicians" ("workOrderId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_wo_tech_person" ON "work_order_technicians" ("personnelId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_wo_tech_person"`);
    await queryRunner.query(`DROP INDEX "IDX_wo_tech_order"`);
    await queryRunner.query(`DROP TABLE "work_order_technicians"`);
    await queryRunner.query(`DROP INDEX "IDX_work_orders_org_number"`);
    await queryRunner.query(`DROP INDEX "IDX_work_orders_org_status"`);
    await queryRunner.query(`DROP TABLE "work_orders"`);
    await queryRunner.query(`DROP INDEX "IDX_maint_req_org_number"`);
    await queryRunner.query(`DROP INDEX "IDX_maint_req_org_status"`);
    await queryRunner.query(`DROP TABLE "maintenance_requests"`);
    await queryRunner.query(`DROP INDEX "IDX_assets_org_code"`);
    await queryRunner.query(`DROP INDEX "IDX_assets_org_status"`);
    await queryRunner.query(`DROP TABLE "assets"`);
  }
}
