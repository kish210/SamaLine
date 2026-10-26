import { MigrationInterface, QueryRunner } from 'typeorm';

/** اتصالِ پرسنل به رباتِ بله/تلگرام با موبایل (Postgres). فاز F. */
export class PgAddPersonnelBotLink1800000000005 implements MigrationInterface {
  name = 'PgAddPersonnelBotLink1800000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "personnel" ADD "botChatId" character varying(40)`,
    );
    await queryRunner.query(
      `ALTER TABLE "personnel" ADD "botPlatform" character varying(16) NOT NULL DEFAULT ''`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_personnel_chat" ON "personnel" ("botPlatform", "botChatId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_personnel_chat"`);
    await queryRunner.query(`ALTER TABLE "personnel" DROP COLUMN "botPlatform"`);
    await queryRunner.query(`ALTER TABLE "personnel" DROP COLUMN "botChatId"`);
  }
}
