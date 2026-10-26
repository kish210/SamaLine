import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * بخشِ مالکِ پرتال و داشبورد (Postgres). فاز B پلتفرم عملیات هتل.
 *
 * خالی بودن یعنی «عمومی/همه‌ی سازمان»؛ پس ستون nullable است و رکوردهای
 * موجود دست‌نخورده می‌مانند.
 */
export class PgAddDepartmentScope1799000000001 implements MigrationInterface {
  name = 'PgAddDepartmentScope1799000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "portals" ADD "departmentId" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "dashboards" ADD "departmentId" uuid`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "dashboards" DROP COLUMN "departmentId"`);
    await queryRunner.query(`ALTER TABLE "portals" DROP COLUMN "departmentId"`);
  }
}
