import { MigrationInterface, QueryRunner } from 'typeorm';

/** نسخه‌ی Postgres حذف ماژول‌های تعمیرات و پایش سردخانه (جدول‌ها + نوع‌های enum). */
export class PgDropHotelOpsModules1796000000001 implements MigrationInterface {
  name = 'PgDropHotelOpsModules1796000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "sensor_alerts" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sensor_readings" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cold_room_sensors" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "maintenance_events" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "room_readiness" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "maintenance_requests" CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."sensor_alerts_kind_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."cold_room_sensors_lasthealth_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."cold_room_sensors_connector_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."room_readiness_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."maintenance_requests_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."maintenance_requests_priority_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."maintenance_requests_category_enum"`);
  }

  public async down(): Promise<void> {
    // بازگشت‌ناپذیر عمدی.
  }
}
