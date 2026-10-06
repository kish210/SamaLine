import { MigrationInterface, QueryRunner } from 'typeorm';

/** ستون‌های تغییر و بازیابی رمز عبور — گویش Postgres. */
export class PgAddPasswordReset1791318984286 implements MigrationInterface {
  name = 'PgAddPasswordReset1791318984286';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "passwordChangedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "passwordResetHash" character varying(64)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "passwordResetExpiresAt" TIMESTAMP WITH TIME ZONE`,
    );
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
