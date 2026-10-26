import { MigrationInterface, QueryRunner } from 'typeorm';

/** اتصالِ پرسنل به رباتِ بله/تلگرام با موبایل (SQLite). فاز F. */
export class AddPersonnelBotLink1800000000004 implements MigrationInterface {
  name = 'AddPersonnelBotLink1800000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "personnel" ADD "botChatId" varchar(40)`,
    );
    await queryRunner.query(
      `ALTER TABLE "personnel" ADD "botPlatform" varchar(16) NOT NULL DEFAULT ('')`,
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
