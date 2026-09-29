import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ستون‌های ورود دومرحله‌ای (TOTP) برای کاربران پنل.
 *
 * هر ستون فقط اگر نباشد اضافه می‌شود تا اجرای دوباره یا پایگاه‌داده‌ای که
 * قبلا با synchronize ساخته شده، مهاجرت را نشکند. ADD COLUMN در SQLite
 * جدول را بازسازی نمی‌کند، پس داده‌ی کاربران دست نمی‌خورد.
 */
export class AddTotp1790656139923 implements MigrationInterface {
  name = 'AddTotp1790656139923';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('users', 'totpSecret'))) {
      await queryRunner.query(
        `ALTER TABLE "users" ADD COLUMN "totpSecret" varchar(255)`,
      );
    }
    if (!(await queryRunner.hasColumn('users', 'totpEnabled'))) {
      await queryRunner.query(
        `ALTER TABLE "users" ADD COLUMN "totpEnabled" boolean NOT NULL DEFAULT (0)`,
      );
    }
    if (!(await queryRunner.hasColumn('users', 'totpLastStep'))) {
      await queryRunner.query(
        `ALTER TABLE "users" ADD COLUMN "totpLastStep" integer`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "totpLastStep"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "totpEnabled"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "totpSecret"`);
  }
}
