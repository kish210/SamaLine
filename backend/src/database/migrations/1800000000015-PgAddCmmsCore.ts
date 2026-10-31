import { MigrationInterface, QueryRunner } from 'typeorm';

/** پایهٔ CMMS: دارایی، درخواستِ تعمیر، دستورِ کار و تکنسین‌ها (Postgres). */
export class PgAddCmmsCore1800000000015 implements MigrationInterface {
  name = 'PgAddCmmsCore1800000000015';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."assets_criticality_enum" AS ENUM('low', 'medium', 'high', 'critical')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."assets_status_enum" AS ENUM('operational', 'under_maintenance', 'out_of_service', 'retired')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."maintenance_requests_category_enum" AS ENUM('electrical', 'plumbing', 'hvac', 'carpentry', 'painting', 'furniture', 'network', 'door_lock', 'other')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."maintenance_requests_priority_enum" AS ENUM('low', 'normal', 'high', 'emergency')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."maintenance_requests_status_enum" AS ENUM('new', 'under_review', 'approved', 'assigned', 'in_progress', 'waiting_parts', 'waiting_contractor', 'follow_up', 'completed', 'rejected', 'closed')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."work_orders_category_enum" AS ENUM('electrical', 'plumbing', 'hvac', 'carpentry', 'painting', 'furniture', 'network', 'door_lock', 'other')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."work_orders_priority_enum" AS ENUM('low', 'normal', 'high', 'emergency')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."work_orders_status_enum" AS ENUM('draft', 'assigned', 'in_progress', 'waiting_parts', 'waiting_contractor', 'completed', 'verified', 'closed', 'cancelled')`,
    );

    await queryRunner.query(
      `CREATE TABLE "assets" (` +
        `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), ` +
        `"organizationId" uuid NOT NULL, ` +
        `"code" character varying(40) NOT NULL, ` +
        `"name" character varying(160) NOT NULL, ` +
        `"category" character varying(80) NOT NULL DEFAULT '', ` +
        `"manufacturer" character varying(120) NOT NULL DEFAULT '', ` +
        `"model" character varying(120) NOT NULL DEFAULT '', ` +
        `"serialNumber" character varying(120) NOT NULL DEFAULT '', ` +
        `"location" character varying(160) NOT NULL DEFAULT '', ` +
        `"building" character varying(80) NOT NULL DEFAULT '', ` +
        `"floor" character varying(40) NOT NULL DEFAULT '', ` +
        `"roomId" uuid, ` +
        `"departmentId" uuid, ` +
        `"parentId" uuid, ` +
        `"installedAt" character varying(10) NOT NULL DEFAULT '', ` +
        `"warrantyUntil" character varying(10) NOT NULL DEFAULT '', ` +
        `"criticality" "public"."assets_criticality_enum" NOT NULL DEFAULT 'medium', ` +
        `"status" "public"."assets_status_enum" NOT NULL DEFAULT 'operational', ` +
        `"documents" jsonb NOT NULL DEFAULT '[]', ` +
        `"notes" text NOT NULL DEFAULT '', ` +
        `"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `"updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "PK_assets" PRIMARY KEY ("id")` +
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
        `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), ` +
        `"organizationId" uuid NOT NULL, ` +
        `"number" character varying(24) NOT NULL, ` +
        `"requestedByUserId" uuid, ` +
        `"requestedByPersonnelId" uuid, ` +
        `"departmentId" uuid, ` +
        `"roomId" uuid, ` +
        `"assetId" uuid, ` +
        `"location" character varying(160) NOT NULL DEFAULT '', ` +
        `"title" character varying(200) NOT NULL, ` +
        `"description" text NOT NULL DEFAULT '', ` +
        `"category" "public"."maintenance_requests_category_enum" NOT NULL DEFAULT 'other', ` +
        `"priority" "public"."maintenance_requests_priority_enum" NOT NULL DEFAULT 'normal', ` +
        `"status" "public"."maintenance_requests_status_enum" NOT NULL DEFAULT 'new', ` +
        `"attachments" jsonb NOT NULL DEFAULT '[]', ` +
        `"operationalImpact" character varying(200) NOT NULL DEFAULT '', ` +
        `"guestRelated" boolean NOT NULL DEFAULT false, ` +
        `"dueDate" character varying(10) NOT NULL DEFAULT '', ` +
        `"rejectionReason" text NOT NULL DEFAULT '', ` +
        `"history" jsonb NOT NULL DEFAULT '[]', ` +
        `"completedAt" TIMESTAMP WITH TIME ZONE, ` +
        `"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `"updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "PK_maintenance_requests" PRIMARY KEY ("id")` +
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
        `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), ` +
        `"organizationId" uuid NOT NULL, ` +
        `"number" character varying(24) NOT NULL, ` +
        `"requestId" uuid, ` +
        `"assetId" uuid, ` +
        `"roomId" uuid, ` +
        `"departmentId" uuid, ` +
        `"title" character varying(200) NOT NULL, ` +
        `"category" "public"."work_orders_category_enum" NOT NULL DEFAULT 'other', ` +
        `"priority" "public"."work_orders_priority_enum" NOT NULL DEFAULT 'normal', ` +
        `"status" "public"."work_orders_status_enum" NOT NULL DEFAULT 'draft', ` +
        `"diagnosis" text NOT NULL DEFAULT '', ` +
        `"rootCause" text NOT NULL DEFAULT '', ` +
        `"workDescription" text NOT NULL DEFAULT '', ` +
        `"workPerformed" text NOT NULL DEFAULT '', ` +
        `"technicianNotes" text NOT NULL DEFAULT '', ` +
        `"parts" jsonb NOT NULL DEFAULT '[]', ` +
        `"laborMinutes" integer NOT NULL DEFAULT 0, ` +
        `"internalCost" integer NOT NULL DEFAULT 0, ` +
        `"contractorCost" integer NOT NULL DEFAULT 0, ` +
        `"attachments" jsonb NOT NULL DEFAULT '[]', ` +
        `"checklist" jsonb NOT NULL DEFAULT '[]', ` +
        `"startedAt" TIMESTAMP WITH TIME ZONE, ` +
        `"completedAt" TIMESTAMP WITH TIME ZONE, ` +
        `"verifiedByUserId" uuid, ` +
        `"verifiedAt" TIMESTAMP WITH TIME ZONE, ` +
        `"dueDate" character varying(10) NOT NULL DEFAULT '', ` +
        `"history" jsonb NOT NULL DEFAULT '[]', ` +
        `"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `"updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "PK_work_orders" PRIMARY KEY ("id")` +
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
        `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), ` +
        `"workOrderId" uuid NOT NULL, ` +
        `"personnelId" uuid NOT NULL, ` +
        `"isPrimary" boolean NOT NULL DEFAULT false, ` +
        `"laborMinutes" integer NOT NULL DEFAULT 0, ` +
        `"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "PK_work_order_technicians" PRIMARY KEY ("id")` +
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
    await queryRunner.query(`DROP INDEX "public"."IDX_wo_tech_person"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_wo_tech_order"`);
    await queryRunner.query(`DROP TABLE "work_order_technicians"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_work_orders_org_number"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_work_orders_org_status"`);
    await queryRunner.query(`DROP TABLE "work_orders"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_maint_req_org_number"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_maint_req_org_status"`);
    await queryRunner.query(`DROP TABLE "maintenance_requests"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_assets_org_code"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_assets_org_status"`);
    await queryRunner.query(`DROP TABLE "assets"`);
    await queryRunner.query(`DROP TYPE "public"."work_orders_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."work_orders_priority_enum"`);
    await queryRunner.query(`DROP TYPE "public"."work_orders_category_enum"`);
    await queryRunner.query(
      `DROP TYPE "public"."maintenance_requests_status_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."maintenance_requests_priority_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."maintenance_requests_category_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."assets_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."assets_criticality_enum"`);
  }
}
