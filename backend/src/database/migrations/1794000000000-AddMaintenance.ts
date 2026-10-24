import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ماژول نگهداری و تعمیرات هتل (SQLite): درخواست‌ها، ردپای ممیزی، و آماده‌بودن اتاق.
 */
export class AddMaintenance1794000000000 implements MigrationInterface {
  name = 'AddMaintenance1794000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "maintenance_requests" (` +
        `"id" varchar PRIMARY KEY NOT NULL, ` +
        `"workspaceId" varchar NOT NULL, ` +
        `"requestNo" varchar(40) NOT NULL, ` +
        `"createdByUserId" varchar, ` +
        `"requesterName" varchar(160) NOT NULL DEFAULT (''), ` +
        `"building" varchar(120) NOT NULL DEFAULT (''), ` +
        `"floor" varchar(120) NOT NULL DEFAULT (''), ` +
        `"room" varchar(120) NOT NULL DEFAULT (''), ` +
        `"locationNote" varchar(300) NOT NULL DEFAULT (''), ` +
        `"category" varchar CHECK( "category" IN ('electrical','plumbing','hvac','carpentry','painting','furniture','network_phone_tv','locks_access','other') ) NOT NULL DEFAULT ('other'), ` +
        `"description" text NOT NULL DEFAULT (''), ` +
        `"priority" varchar CHECK( "priority" IN ('normal','urgent','emergency') ) NOT NULL DEFAULT ('normal'), ` +
        `"assignedTo" varchar(160) NOT NULL DEFAULT (''), ` +
        `"status" varchar CHECK( "status" IN ('new','in_progress','waiting_part','contractor_required','follow_up','done','cancelled') ) NOT NULL DEFAULT ('new'), ` +
        `"workNotes" text NOT NULL DEFAULT (''), ` +
        `"completionNotes" text NOT NULL DEFAULT (''), ` +
        `"estimatedCost" bigint NOT NULL DEFAULT (0), ` +
        `"actualCost" bigint NOT NULL DEFAULT (0), ` +
        `"attachments" text NOT NULL DEFAULT ('[]'), ` +
        `"closedAt" datetime, ` +
        `"archivedAt" datetime, ` +
        `"createdAt" datetime NOT NULL DEFAULT (datetime('now')), ` +
        `"updatedAt" datetime NOT NULL DEFAULT (datetime('now'))` +
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
        `"id" varchar PRIMARY KEY NOT NULL, ` +
        `"requestId" varchar NOT NULL, ` +
        `"actorId" varchar, ` +
        `"actorName" varchar(160) NOT NULL DEFAULT (''), ` +
        `"action" varchar(40) NOT NULL, ` +
        `"fromValue" varchar(160), ` +
        `"toValue" varchar(160), ` +
        `"note" text NOT NULL DEFAULT (''), ` +
        `"createdAt" datetime NOT NULL DEFAULT (datetime('now')), ` +
        `CONSTRAINT "FK_0280c78b8a22604707612be3d60" FOREIGN KEY ("requestId") REFERENCES "maintenance_requests" ("id") ON DELETE CASCADE ON UPDATE NO ACTION` +
        `)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_maintenance_event_request" ON "maintenance_events" ("requestId")`,
    );

    await queryRunner.query(
      `CREATE TABLE "room_readiness" (` +
        `"id" varchar PRIMARY KEY NOT NULL, ` +
        `"workspaceId" varchar NOT NULL, ` +
        `"room" varchar(120) NOT NULL, ` +
        `"building" varchar(120) NOT NULL DEFAULT (''), ` +
        `"floor" varchar(120) NOT NULL DEFAULT (''), ` +
        `"status" varchar CHECK( "status" IN ('ready','needs_inspection','not_ready') ) NOT NULL DEFAULT ('needs_inspection'), ` +
        `"note" varchar(300) NOT NULL DEFAULT (''), ` +
        `"updatedByName" varchar(160) NOT NULL DEFAULT (''), ` +
        `"createdAt" datetime NOT NULL DEFAULT (datetime('now')), ` +
        `"updatedAt" datetime NOT NULL DEFAULT (datetime('now'))` +
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
    await queryRunner.query(`DROP INDEX "IDX_room_readiness_ws_status"`);
    await queryRunner.query(`DROP INDEX "IDX_room_readiness_ws_room"`);
    await queryRunner.query(`DROP TABLE "room_readiness"`);
    await queryRunner.query(`DROP INDEX "IDX_maintenance_event_request"`);
    await queryRunner.query(`DROP TABLE "maintenance_events"`);
    await queryRunner.query(`DROP INDEX "IDX_maintenance_ws_no"`);
    await queryRunner.query(`DROP INDEX "IDX_maintenance_ws_status"`);
    await queryRunner.query(`DROP TABLE "maintenance_requests"`);
  }
}
