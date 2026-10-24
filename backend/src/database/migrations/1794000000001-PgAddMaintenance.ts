import { MigrationInterface, QueryRunner } from 'typeorm';

/** نسخه‌ی Postgres ماژول نگهداری و تعمیرات هتل. */
export class PgAddMaintenance1794000000001 implements MigrationInterface {
  name = 'PgAddMaintenance1794000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."maintenance_requests_category_enum" AS ENUM('electrical', 'plumbing', 'hvac', 'carpentry', 'painting', 'furniture', 'network_phone_tv', 'locks_access', 'other')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."maintenance_requests_priority_enum" AS ENUM('normal', 'urgent', 'emergency')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."maintenance_requests_status_enum" AS ENUM('new', 'in_progress', 'waiting_part', 'contractor_required', 'follow_up', 'done', 'cancelled')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."room_readiness_status_enum" AS ENUM('ready', 'needs_inspection', 'not_ready')`,
    );

    await queryRunner.query(
      `CREATE TABLE "maintenance_requests" (` +
        `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), ` +
        `"workspaceId" uuid NOT NULL, ` +
        `"requestNo" character varying(40) NOT NULL, ` +
        `"createdByUserId" uuid, ` +
        `"requesterName" character varying(160) NOT NULL DEFAULT '', ` +
        `"building" character varying(120) NOT NULL DEFAULT '', ` +
        `"floor" character varying(120) NOT NULL DEFAULT '', ` +
        `"room" character varying(120) NOT NULL DEFAULT '', ` +
        `"locationNote" character varying(300) NOT NULL DEFAULT '', ` +
        `"category" "public"."maintenance_requests_category_enum" NOT NULL DEFAULT 'other', ` +
        `"description" text NOT NULL DEFAULT '', ` +
        `"priority" "public"."maintenance_requests_priority_enum" NOT NULL DEFAULT 'normal', ` +
        `"assignedTo" character varying(160) NOT NULL DEFAULT '', ` +
        `"status" "public"."maintenance_requests_status_enum" NOT NULL DEFAULT 'new', ` +
        `"workNotes" text NOT NULL DEFAULT '', ` +
        `"completionNotes" text NOT NULL DEFAULT '', ` +
        `"estimatedCost" bigint NOT NULL DEFAULT '0', ` +
        `"actualCost" bigint NOT NULL DEFAULT '0', ` +
        `"attachments" jsonb NOT NULL DEFAULT '[]', ` +
        `"closedAt" TIMESTAMP WITH TIME ZONE, ` +
        `"archivedAt" TIMESTAMP WITH TIME ZONE, ` +
        `"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `"updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "PK_maintenance_requests" PRIMARY KEY ("id")` +
        `)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_maintenance_ws_status" ON "maintenance_requests" ("workspaceId", "status")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_maintenance_ws_no" ON "maintenance_requests" ("workspaceId", "requestNo")`,
    );

    await queryRunner.query(
      `CREATE TABLE "maintenance_events" (` +
        `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), ` +
        `"requestId" uuid NOT NULL, ` +
        `"actorId" uuid, ` +
        `"actorName" character varying(160) NOT NULL DEFAULT '', ` +
        `"action" character varying(40) NOT NULL, ` +
        `"fromValue" character varying(160), ` +
        `"toValue" character varying(160), ` +
        `"note" text NOT NULL DEFAULT '', ` +
        `"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "PK_maintenance_events" PRIMARY KEY ("id")` +
        `)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_maintenance_event_request" ON "maintenance_events" ("requestId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "maintenance_events" ADD CONSTRAINT "FK_0280c78b8a22604707612be3d60" FOREIGN KEY ("requestId") REFERENCES "maintenance_requests"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "room_readiness" (` +
        `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), ` +
        `"workspaceId" uuid NOT NULL, ` +
        `"room" character varying(120) NOT NULL, ` +
        `"building" character varying(120) NOT NULL DEFAULT '', ` +
        `"floor" character varying(120) NOT NULL DEFAULT '', ` +
        `"status" "public"."room_readiness_status_enum" NOT NULL DEFAULT 'needs_inspection', ` +
        `"note" character varying(300) NOT NULL DEFAULT '', ` +
        `"updatedByName" character varying(160) NOT NULL DEFAULT '', ` +
        `"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `"updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "PK_room_readiness" PRIMARY KEY ("id")` +
        `)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_room_readiness_ws_room" ON "room_readiness" ("workspaceId", "room")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_room_readiness_ws_status" ON "room_readiness" ("workspaceId", "status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "room_readiness"`);
    await queryRunner.query(`DROP TYPE "public"."room_readiness_status_enum"`);
    await queryRunner.query(
      `ALTER TABLE "maintenance_events" DROP CONSTRAINT "FK_0280c78b8a22604707612be3d60"`,
    );
    await queryRunner.query(`DROP TABLE "maintenance_events"`);
    await queryRunner.query(`DROP TABLE "maintenance_requests"`);
    await queryRunner.query(`DROP TYPE "public"."maintenance_requests_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."maintenance_requests_priority_enum"`);
    await queryRunner.query(`DROP TYPE "public"."maintenance_requests_category_enum"`);
  }
}
