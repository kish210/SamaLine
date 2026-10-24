import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * حذف ماژول‌های تعمیرات و پایش سردخانه (SQLite).
 *
 * تصمیم محصول: کل کارِ نگهداری/بخش‌ها فرم‌محور می‌شود (فرم + پرتال + داشبورد)،
 * پس این جدول‌ها (که خالی بودند) برداشته می‌شوند. ترتیب حذف از جدول‌های
 * فرزند (دارای FK) به والد است. در SQLite با DROP TABLE ایندکس‌ها هم می‌روند.
 */
export class DropHotelOpsModules1796000000000 implements MigrationInterface {
  name = 'DropHotelOpsModules1796000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "sensor_alerts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sensor_readings"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cold_room_sensors"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "maintenance_events"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "room_readiness"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "maintenance_requests"`);
  }

  public async down(): Promise<void> {
    // بازگشت‌ناپذیر عمدی: این ماژول‌ها حذف شده‌اند و جدول‌ها خالی بودند.
  }
}
