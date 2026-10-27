import { MigrationInterface, QueryRunner } from 'typeorm';

/** فضای کاریِ رباتِ هر پرسنل برای ارسالِ اطلاعیه (Postgres). فاز F. */
export class PgAddPersonnelBotWorkspace1800000000007
  implements MigrationInterface
{
  name = 'PgAddPersonnelBotWorkspace1800000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "personnel" ADD "botWorkspaceId" uuid`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "personnel" DROP COLUMN "botWorkspaceId"`,
    );
  }
}
