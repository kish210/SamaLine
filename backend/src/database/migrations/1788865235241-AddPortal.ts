import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPortal1788865235241 implements MigrationInterface {
    name = 'AddPortal1788865235241'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "portals" ("id" varchar PRIMARY KEY NOT NULL, "workspaceId" varchar NOT NULL, "slug" varchar(80) NOT NULL, "title" varchar(160) NOT NULL, "description" text NOT NULL DEFAULT (''), "formIds" text NOT NULL DEFAULT ('[]'), "logoUrl" varchar(500) NOT NULL DEFAULT (''), "isActive" boolean NOT NULL DEFAULT (1), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_f437df460ca595ccedfb080145" ON "portals" ("slug") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_f437df460ca595ccedfb080145"`);
        await queryRunner.query(`DROP TABLE "portals"`);
    }

}
