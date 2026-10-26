import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * بخشِ مالکِ پرتال و داشبورد (SQLite). فاز B پلتفرم عملیات هتل.
 *
 * خالی بودن یعنی «عمومی/همه‌ی سازمان»؛ پس ستون nullable است و رکوردهای
 * موجود دست‌نخورده می‌مانند.
 */
export class AddDepartmentScope1799000000000 implements MigrationInterface {
  name = 'AddDepartmentScope1799000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "portals" ADD COLUMN "departmentId" varchar`,
    );
    await queryRunner.query(
      `ALTER TABLE "dashboards" ADD COLUMN "departmentId" varchar`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "dashboards" DROP COLUMN "departmentId"`);
    await queryRunner.query(`ALTER TABLE "portals" DROP COLUMN "departmentId"`);
  }
}
