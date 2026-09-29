import { MigrationInterface, QueryRunner } from 'typeorm';

/** ستون‌های ورود دومرحله‌ای (TOTP) — گویش Postgres. */
export class PgAddTotp1790656139924 implements MigrationInterface {
  name = 'PgAddTotp1790656139924';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totpSecret" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totpEnabled" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "totpLastStep" integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "totpLastStep"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "totpEnabled"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "totpSecret"`);
  }
}
