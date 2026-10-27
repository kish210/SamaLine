import { MigrationInterface, QueryRunner } from 'typeorm';

/** ظاهرِ قابل‌تغییرِ منوی QR (Postgres). */
export class PgAddMenuTheme1800000000011 implements MigrationInterface {
  name = 'PgAddMenuTheme1800000000011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "menus" ADD "theme" character varying(30) NOT NULL DEFAULT 'classic'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "menus" DROP COLUMN "theme"`);
  }
}
