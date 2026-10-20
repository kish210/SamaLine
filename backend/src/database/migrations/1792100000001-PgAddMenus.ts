import { MigrationInterface, QueryRunner } from 'typeorm';

/** جدول منوی QR — گویش Postgres. */
export class PgAddMenus1792100000001 implements MigrationInterface {
  name = 'PgAddMenus1792100000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "menus" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workspaceId" uuid NOT NULL, "slug" character varying(80) NOT NULL, "title" character varying(160) NOT NULL, "description" text NOT NULL DEFAULT '', "logoUrl" character varying(500) NOT NULL DEFAULT '', "images" jsonb NOT NULL DEFAULT '[]', "sections" jsonb NOT NULL DEFAULT '[]', "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_menus_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_478abfb63bdfce389d94d5d932" ON "menus" ("slug") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "menus"`);
  }
}
