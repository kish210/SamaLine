import { MigrationInterface, QueryRunner } from 'typeorm';

/** نقش، آخرین استفاده و انقضای کلید API — گویش Postgres. */
export class PgAddApiKeyRole1791319534734 implements MigrationInterface {
  name = 'PgAddApiKeyRole1791319534734';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "role" character varying(20) NOT NULL DEFAULT 'viewer'`,
    );
    await queryRunner.query(
      `ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "lastUsedAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "api_keys" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "api_keys" DROP COLUMN IF EXISTS "expiresAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "api_keys" DROP COLUMN IF EXISTS "lastUsedAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "api_keys" DROP COLUMN IF EXISTS "role"`,
    );
  }
}
