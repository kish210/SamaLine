import { MigrationInterface, QueryRunner } from 'typeorm';

/** جدول منوی QR. */
export class AddMenus1792100000000 implements MigrationInterface {
  name = 'AddMenus1792100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('menus')) return;
    await queryRunner.query(
      `CREATE TABLE "menus" ("id" varchar PRIMARY KEY NOT NULL, "workspaceId" varchar NOT NULL, "slug" varchar(80) NOT NULL, "title" varchar(160) NOT NULL, "description" text NOT NULL DEFAULT (''), "logoUrl" varchar(500) NOT NULL DEFAULT (''), "images" text NOT NULL DEFAULT ('[]'), "sections" text NOT NULL DEFAULT ('[]'), "isActive" boolean NOT NULL DEFAULT (1), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "updatedAt" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_478abfb63bdfce389d94d5d932" ON "menus" ("slug") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_478abfb63bdfce389d94d5d932"`);
    await queryRunner.query(`DROP TABLE "menus"`);
  }
}
