import { MigrationInterface, QueryRunner } from 'typeorm';

/** اتاق‌های هتل به‌عنوان داده‌ی پایه (Postgres). فاز D. */
export class PgAddHotelRooms1800000000001 implements MigrationInterface {
  name = 'PgAddHotelRooms1800000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "hotel_rooms" (` +
        `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), ` +
        `"organizationId" uuid NOT NULL, ` +
        `"number" character varying(20) NOT NULL, ` +
        `"floor" integer NOT NULL DEFAULT 0, ` +
        `"kind" character varying(60) NOT NULL DEFAULT '', ` +
        `"assets" jsonb NOT NULL DEFAULT '[]', ` +
        `"isActive" boolean NOT NULL DEFAULT true, ` +
        `"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `"updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "PK_hotel_rooms" PRIMARY KEY ("id")` +
        `)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_hotel_room_org" ON "hotel_rooms" ("organizationId")`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_hotel_room_unique" ON "hotel_rooms" ("organizationId", "number")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_hotel_room_unique"`);
    await queryRunner.query(`DROP INDEX "IDX_hotel_room_org"`);
    await queryRunner.query(`DROP TABLE "hotel_rooms"`);
  }
}
