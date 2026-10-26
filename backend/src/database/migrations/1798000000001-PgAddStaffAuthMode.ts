import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * افزودن حالت احراز `staff` به انتشار (Postgres). فاز A۱.
 *
 * در Postgres مقدار تازه مستقیم به نوعِ enum اضافه می‌شود. برگشت‌پذیر نیست:
 * `ALTER TYPE … DROP VALUE` وجود ندارد، پس `down` فقط ردیف‌ها را به `none`
 * برمی‌گرداند و خودِ مقدار در نوع می‌ماند — بی‌ضرر است و جلوی شکستنِ
 * برگشت را می‌گیرد.
 */
export class PgAddStaffAuthMode1798000000001 implements MigrationInterface {
  name = 'PgAddStaffAuthMode1798000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."publications_authmode_enum" ADD VALUE IF NOT EXISTS 'staff'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "publications" SET "authMode" = 'none' WHERE "authMode" = 'staff'`,
    );
  }
}
