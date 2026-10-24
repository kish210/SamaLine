import { MigrationInterface, QueryRunner } from 'typeorm';

/** نسخه‌ی Postgres سنسورهای دمای سردخانه. */
export class PgAddColdRoomSensors1795000000001 implements MigrationInterface {
  name = 'PgAddColdRoomSensors1795000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."cold_room_sensors_connector_enum" AS ENUM('manual', 'http', 'simulated')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."cold_room_sensors_lasthealth_enum" AS ENUM('ok', 'low', 'high', 'stale', 'unknown')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."sensor_alerts_kind_enum" AS ENUM('low', 'high', 'stale')`,
    );

    await queryRunner.query(
      `CREATE TABLE "cold_room_sensors" (` +
        `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), ` +
        `"workspaceId" uuid NOT NULL, ` +
        `"name" character varying(160) NOT NULL, ` +
        `"location" character varying(200) NOT NULL DEFAULT '', ` +
        `"unit" character varying(1) NOT NULL DEFAULT 'C', ` +
        `"minThreshold" double precision, ` +
        `"maxThreshold" double precision, ` +
        `"staleAfterSeconds" integer NOT NULL DEFAULT 600, ` +
        `"connector" "public"."cold_room_sensors_connector_enum" NOT NULL DEFAULT 'simulated', ` +
        `"connectorConfig" jsonb NOT NULL DEFAULT '{}', ` +
        `"isActive" boolean NOT NULL DEFAULT true, ` +
        `"lastValue" double precision, ` +
        `"lastReadingAt" TIMESTAMP WITH TIME ZONE, ` +
        `"lastHealth" "public"."cold_room_sensors_lasthealth_enum" NOT NULL DEFAULT 'unknown', ` +
        `"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `"updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "PK_cold_room_sensors" PRIMARY KEY ("id")` +
        `)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cold_room_ws" ON "cold_room_sensors" ("workspaceId")`,
    );

    await queryRunner.query(
      `CREATE TABLE "sensor_readings" (` +
        `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), ` +
        `"sensorId" uuid NOT NULL, ` +
        `"value" double precision NOT NULL, ` +
        `"unit" character varying(1) NOT NULL DEFAULT 'C', ` +
        `"isSimulated" boolean NOT NULL DEFAULT false, ` +
        `"observedAt" TIMESTAMP WITH TIME ZONE NOT NULL, ` +
        `"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "PK_sensor_readings" PRIMARY KEY ("id")` +
        `)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sensor_reading_sensor_time" ON "sensor_readings" ("sensorId", "observedAt")`,
    );
    await queryRunner.query(
      `ALTER TABLE "sensor_readings" ADD CONSTRAINT "FK_2294ea040e40e484fc719bd75bc" FOREIGN KEY ("sensorId") REFERENCES "cold_room_sensors"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "sensor_alerts" (` +
        `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), ` +
        `"sensorId" uuid NOT NULL, ` +
        `"kind" "public"."sensor_alerts_kind_enum" NOT NULL, ` +
        `"value" double precision, ` +
        `"message" character varying(300) NOT NULL DEFAULT '', ` +
        `"acknowledgedAt" TIMESTAMP WITH TIME ZONE, ` +
        `"acknowledgedBy" character varying(160), ` +
        `"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "PK_sensor_alerts" PRIMARY KEY ("id")` +
        `)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_sensor_alert_sensor" ON "sensor_alerts" ("sensorId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "sensor_alerts" ADD CONSTRAINT "FK_68ccb500cfb6e1b58aa9cf8a355" FOREIGN KEY ("sensorId") REFERENCES "cold_room_sensors"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "sensor_alerts" DROP CONSTRAINT "FK_68ccb500cfb6e1b58aa9cf8a355"`);
    await queryRunner.query(`DROP TABLE "sensor_alerts"`);
    await queryRunner.query(`ALTER TABLE "sensor_readings" DROP CONSTRAINT "FK_2294ea040e40e484fc719bd75bc"`);
    await queryRunner.query(`DROP TABLE "sensor_readings"`);
    await queryRunner.query(`DROP INDEX "IDX_cold_room_ws"`);
    await queryRunner.query(`DROP TABLE "cold_room_sensors"`);
    await queryRunner.query(`DROP TYPE "public"."sensor_alerts_kind_enum"`);
    await queryRunner.query(`DROP TYPE "public"."cold_room_sensors_lasthealth_enum"`);
    await queryRunner.query(`DROP TYPE "public"."cold_room_sensors_connector_enum"`);
  }
}
