import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * ستون‌های تغییر و بازیابی رمز عبور.
 *
 * هر ستون فقط اگر نباشد اضافه می‌شود تا اجرای دوباره مهاجرت را نشکند.
 */
export class AddPasswordReset1791318984285 implements MigrationInterface {
  name = 'AddPasswordReset1791318984285';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const columns: Array<[string, string]> = [
      ['passwordChangedAt', 'datetime'],
      ['passwordResetHash', 'varchar(64)'],
      ['passwordResetExpiresAt', 'datetime'],
    ];
    for (const [name, type] of columns) {
      if (!(await queryRunner.hasColumn('users', name))) {
        await queryRunner.query(
          `ALTER TABLE "users" ADD COLUMN "${name}" ${type}`,
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "passwordResetExpiresAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "passwordResetHash"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "passwordChangedAt"`,
    );
  }
}
