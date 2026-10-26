import { MigrationInterface, QueryRunner } from 'typeorm';

/** اتاق‌های هتل به‌عنوان داده‌ی پایه (SQLite). فاز D پلتفرم عملیات هتل. */
export class AddHotelRooms1800000000000 implements MigrationInterface {
  name = 'AddHotelRooms1800000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "hotel_rooms" (` +
        `"id" varchar PRIMARY KEY NOT NULL, ` +
        `"organizationId" varchar NOT NULL, ` +
        `"number" varchar(20) NOT NULL, ` +
        `"floor" integer NOT NULL DEFAULT (0), ` +
        `"kind" varchar(60) NOT NULL DEFAULT (''), ` +
        `"assets" text NOT NULL DEFAULT ('[]'), ` +
        `"isActive" boolean NOT NULL DEFAULT (1), ` +
        `"createdAt" datetime NOT NULL DEFAULT (datetime('now')), ` +
        `"updatedAt" datetime NOT NULL DEFAULT (datetime('now'))` +
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
