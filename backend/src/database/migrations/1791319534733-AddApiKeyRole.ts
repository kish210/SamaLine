import { MigrationInterface, QueryRunner } from 'typeorm';

/** نقش، آخرین استفاده و انقضای کلید API. */
export class AddApiKeyRole1791319534733 implements MigrationInterface {
  name = 'AddApiKeyRole1791319534733';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('api_keys');
    if (!table) return;
    const has = (column: string) =>
      table.columns.some((c) => c.name === column);

    if (!has('role')) {
      await queryRunner.query(
        `ALTER TABLE "api_keys" ADD COLUMN "role" varchar(20) NOT NULL DEFAULT ('viewer')`,
      );
    }
    if (!has('lastUsedAt')) {
      await queryRunner.query(
        `ALTER TABLE "api_keys" ADD COLUMN "lastUsedAt" datetime`,
      );
    }
    if (!has('expiresAt')) {
      await queryRunner.query(
        `ALTER TABLE "api_keys" ADD COLUMN "expiresAt" datetime`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "api_keys" DROP COLUMN "expiresAt"`);
    await queryRunner.query(`ALTER TABLE "api_keys" DROP COLUMN "lastUsedAt"`);
    await queryRunner.query(`ALTER TABLE "api_keys" DROP COLUMN "role"`);
  }
}
