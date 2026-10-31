import { MigrationInterface, QueryRunner } from 'typeorm';

const MOVEMENT_TYPE = `'receipt', 'issue', 'return', 'scrap', 'adjust_in', 'adjust_out'`;

/** انبارِ قطعات + دفترِ گردش (SQLite). */
export class AddInventory1800000000020 implements MigrationInterface {
  name = 'AddInventory1800000000020';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "spare_parts" (` +
        `"id" varchar PRIMARY KEY NOT NULL, ` +
        `"organizationId" varchar NOT NULL, ` +
        `"code" varchar(40) NOT NULL, ` +
        `"name" varchar(160) NOT NULL, ` +
        `"category" varchar(80) NOT NULL DEFAULT (''), ` +
        `"unit" varchar(24) NOT NULL DEFAULT ('عدد'), ` +
        `"quantityOnHand" integer NOT NULL DEFAULT (0), ` +
        `"reorderLevel" integer NOT NULL DEFAULT (0), ` +
        `"unitCost" integer NOT NULL DEFAULT (0), ` +
        `"location" varchar(160) NOT NULL DEFAULT (''), ` +
        `"supplier" varchar(160) NOT NULL DEFAULT (''), ` +
        `"notes" text NOT NULL DEFAULT (''), ` +
        `"isActive" boolean NOT NULL DEFAULT (1), ` +
        `"createdAt" datetime NOT NULL DEFAULT (datetime('now')), ` +
        `"updatedAt" datetime NOT NULL DEFAULT (datetime('now'))` +
        `)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_spare_parts_org_code" ON "spare_parts" ("organizationId", "code")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_spare_parts_org_active" ON "spare_parts" ("organizationId", "isActive")`,
    );

    await queryRunner.query(
      `CREATE TABLE "stock_movements" (` +
        `"id" varchar PRIMARY KEY NOT NULL, ` +
        `"organizationId" varchar NOT NULL, ` +
        `"partId" varchar NOT NULL, ` +
        `"type" varchar CHECK( "type" IN (${MOVEMENT_TYPE}) ) NOT NULL, ` +
        `"quantity" integer NOT NULL, ` +
        `"unitCost" integer NOT NULL DEFAULT (0), ` +
        `"totalCost" integer NOT NULL DEFAULT (0), ` +
        `"balanceAfter" integer NOT NULL DEFAULT (0), ` +
        `"workOrderId" varchar, ` +
        `"personnelId" varchar, ` +
        `"reference" varchar(80) NOT NULL DEFAULT (''), ` +
        `"note" varchar(300) NOT NULL DEFAULT (''), ` +
        `"byUserId" varchar, ` +
        `"createdAt" datetime NOT NULL DEFAULT (datetime('now'))` +
        `)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_stock_mov_org_part" ON "stock_movements" ("organizationId", "partId", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_stock_mov_order" ON "stock_movements" ("workOrderId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_stock_mov_order"`);
    await queryRunner.query(`DROP INDEX "IDX_stock_mov_org_part"`);
    await queryRunner.query(`DROP TABLE "stock_movements"`);
    await queryRunner.query(`DROP INDEX "IDX_spare_parts_org_active"`);
    await queryRunner.query(`DROP INDEX "IDX_spare_parts_org_code"`);
    await queryRunner.query(`DROP TABLE "spare_parts"`);
  }
}
