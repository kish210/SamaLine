import { MigrationInterface, QueryRunner } from 'typeorm';

/** انبارِ قطعات + دفترِ گردش (Postgres). */
export class PgAddInventory1800000000021 implements MigrationInterface {
  name = 'PgAddInventory1800000000021';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."stock_movements_type_enum" AS ENUM('receipt', 'issue', 'return', 'scrap', 'adjust_in', 'adjust_out')`,
    );

    await queryRunner.query(
      `CREATE TABLE "spare_parts" (` +
        `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), ` +
        `"organizationId" uuid NOT NULL, ` +
        `"code" character varying(40) NOT NULL, ` +
        `"name" character varying(160) NOT NULL, ` +
        `"category" character varying(80) NOT NULL DEFAULT '', ` +
        `"unit" character varying(24) NOT NULL DEFAULT 'عدد', ` +
        `"quantityOnHand" integer NOT NULL DEFAULT 0, ` +
        `"reorderLevel" integer NOT NULL DEFAULT 0, ` +
        `"unitCost" integer NOT NULL DEFAULT 0, ` +
        `"location" character varying(160) NOT NULL DEFAULT '', ` +
        `"supplier" character varying(160) NOT NULL DEFAULT '', ` +
        `"notes" text NOT NULL DEFAULT '', ` +
        `"isActive" boolean NOT NULL DEFAULT true, ` +
        `"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `"updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "PK_spare_parts" PRIMARY KEY ("id")` +
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
        `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), ` +
        `"organizationId" uuid NOT NULL, ` +
        `"partId" uuid NOT NULL, ` +
        `"type" "public"."stock_movements_type_enum" NOT NULL, ` +
        `"quantity" integer NOT NULL, ` +
        `"unitCost" integer NOT NULL DEFAULT 0, ` +
        `"totalCost" integer NOT NULL DEFAULT 0, ` +
        `"balanceAfter" integer NOT NULL DEFAULT 0, ` +
        `"workOrderId" uuid, ` +
        `"personnelId" uuid, ` +
        `"reference" character varying(80) NOT NULL DEFAULT '', ` +
        `"note" character varying(300) NOT NULL DEFAULT '', ` +
        `"byUserId" uuid, ` +
        `"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "PK_stock_movements" PRIMARY KEY ("id")` +
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
    await queryRunner.query(`DROP INDEX "public"."IDX_stock_mov_order"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_stock_mov_org_part"`);
    await queryRunner.query(`DROP TABLE "stock_movements"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_spare_parts_org_active"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_spare_parts_org_code"`);
    await queryRunner.query(`DROP TABLE "spare_parts"`);
    await queryRunner.query(`DROP TYPE "public"."stock_movements_type_enum"`);
  }
}
