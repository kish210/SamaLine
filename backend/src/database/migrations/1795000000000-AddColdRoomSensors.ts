import { MigrationInterface, QueryRunner } from 'typeorm';

/** سنسورهای دمای سردخانه‌ی هتل (SQLite): سنسورها، قرائت‌ها و هشدارها. */
export class AddColdRoomSensors1795000000000 implements MigrationInterface {
  name = 'AddColdRoomSensors1795000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "cold_room_sensors" (` +
        `"id" varchar PRIMARY KEY NOT NULL, ` +
        `"workspaceId" varchar NOT NULL, ` +
        `"name" varchar(160) NOT NULL, ` +
        `"location" varchar(200) NOT NULL DEFAULT (''), ` +
        `"unit" varchar(1) NOT NULL DEFAULT ('C'), ` +
        `"minThreshold" double precision, ` +
        `"maxThreshold" double precision, ` +
        `"staleAfterSeconds" integer NOT NULL DEFAULT (600), ` +
        `"connector" varchar CHECK( "connector" IN ('manual','http','simulated') ) NOT NULL DEFAULT ('simulated'), ` +
        `"connectorConfig" text NOT NULL DEFAULT ('{}'), ` +
        `"isActive" boolean NOT NULL DEFAULT (1), ` +
        `"lastValue" double precision, ` +
        `"lastReadingAt" datetime, ` +
        `"lastHealth" varchar CHECK( "lastHealth" IN ('ok','low','high','stale','unknown') ) NOT NULL DEFAULT ('unknown'), ` +
        `"createdAt" datetime NOT NULL DEFAULT (datetime('now')), ` +
        `"updatedAt" datetime NOT NULL DEFAULT (datetime('now'))` +
        `)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cold_room_ws" ON "cold_room_sensors" ("workspaceId")`,
    );

    await queryRunner.query(
      `CREATE TABLE "sensor_readings" (` +
        `"id" varchar PRIMARY KEY NOT NULL, ` +
        `"sensorId" varchar NOT NULL, ` +
        `"value" double precision NOT NULL, ` +
        `"unit" varchar(1) NOT NULL DEFAULT ('C'), ` +
        `"isSimulated" boolean NOT NULL DEFAULT (0), ` +
        `"observedAt" datetime NOT NULL, ` +
        `"createdAt" datetime NOT NULL DEFAULT (datetime('now')), ` +
        `CONSTRAINT "FK_2294ea040e40e484fc719bd75bc" FOREIGN KEY ("sensorId") REFERENCES "cold_room_sensors" ("id") ON DELETE CASCADE ON UPDATE NO ACTION` +
        `)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sensor_reading_sensor_time" ON "sensor_readings" ("sensorId", "observedAt")`,
    );

    await queryRunner.query(
      `CREATE TABLE "sensor_alerts" (` +
        `"id" varchar PRIMARY KEY NOT NULL, ` +
        `"sensorId" varchar NOT NULL, ` +
        `"kind" varchar CHECK( "kind" IN ('low','high','stale') ) NOT NULL, ` +
        `"value" double precision, ` +
        `"message" varchar(300) NOT NULL DEFAULT (''), ` +
        `"acknowledgedAt" datetime, ` +
        `"acknowledgedBy" varchar(160), ` +
        `"createdAt" datetime NOT NULL DEFAULT (datetime('now')), ` +
        `CONSTRAINT "FK_68ccb500cfb6e1b58aa9cf8a355" FOREIGN KEY ("sensorId") REFERENCES "cold_room_sensors" ("id") ON DELETE CASCADE ON UPDATE NO ACTION` +
        `)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sensor_alert_sensor" ON "sensor_alerts" ("sensorId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_sensor_alert_sensor"`);
    await queryRunner.query(`DROP TABLE "sensor_alerts"`);
    await queryRunner.query(`DROP INDEX "IDX_sensor_reading_sensor_time"`);
    await queryRunner.query(`DROP TABLE "sensor_readings"`);
    await queryRunner.query(`DROP INDEX "IDX_cold_room_ws"`);
    await queryRunner.query(`DROP TABLE "cold_room_sensors"`);
  }
}
