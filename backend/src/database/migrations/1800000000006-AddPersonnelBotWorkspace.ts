import { MigrationInterface, QueryRunner } from 'typeorm';

/** فضای کاریِ رباتِ هر پرسنل برای ارسالِ اطلاعیه (SQLite). فاز F. */
export class AddPersonnelBotWorkspace1800000000006
  implements MigrationInterface
{
  name = 'AddPersonnelBotWorkspace1800000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "personnel" ADD "botWorkspaceId" varchar`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "personnel" DROP COLUMN "botWorkspaceId"`,
    );
  }
}
