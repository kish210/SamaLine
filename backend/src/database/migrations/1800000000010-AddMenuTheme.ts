import { MigrationInterface, QueryRunner } from 'typeorm';

/** ظاهرِ قابل‌تغییرِ منوی QR (SQLite). */
export class AddMenuTheme1800000000010 implements MigrationInterface {
  name = 'AddMenuTheme1800000000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "menus" ADD "theme" varchar(30) NOT NULL DEFAULT ('classic')`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "menus" DROP COLUMN "theme"`);
  }
}
