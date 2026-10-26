import { MigrationInterface, QueryRunner } from 'typeorm';

const OLD = `'none','param','link','password','otp','oauth','ldap'`;
const NEW = `'none','param','link','password','otp','oauth','ldap','staff'`;

/**
 * افزودن حالت احراز `staff` به انتشار (SQLite). فاز A۱ پلتفرم عملیات هتل.
 *
 * SQLite نوع enum ندارد و مقدارهای مجاز با CHECK روی ستون نوشته می‌شوند؛
 * تغییرشان یعنی بازسازی جدول. ترتیبِ ستون‌ها و نام قیدهای یکتا عینا حفظ
 * می‌شود تا با چیزی که TypeORM از روی موجودیت می‌سازد یکی بماند و
 * `schema-drift` سبز باشد.
 */
export class AddStaffAuthMode1798000000000 implements MigrationInterface {
  name = 'AddStaffAuthMode1798000000000';

  private table(check: string): string {
    return (
      `CREATE TABLE "temporary_publications" (` +
      `"id" varchar PRIMARY KEY NOT NULL, ` +
      `"formId" varchar NOT NULL, ` +
      `"type" varchar CHECK( "type" IN ('link','qr','embed','popup','sms','email','kiosk','app','portal','interviewer','social') ) NOT NULL DEFAULT ('link'), ` +
      `"authMode" varchar CHECK( "authMode" IN (${check}) ) NOT NULL DEFAULT ('none'), ` +
      `"token" varchar(80) NOT NULL, ` +
      `"slug" varchar(80), ` +
      `"tags" text NOT NULL DEFAULT ('[]'), ` +
      `"customDomain" varchar(240), ` +
      `"expiresAt" datetime, ` +
      `"quota" integer, ` +
      `"config" text NOT NULL DEFAULT ('{}'), ` +
      `"viewCount" integer NOT NULL DEFAULT (0), ` +
      `"isActive" boolean NOT NULL DEFAULT (1), ` +
      `"createdAt" datetime NOT NULL DEFAULT (datetime('now')), ` +
      `CONSTRAINT "UQ_30e8d9fc020f2dc0d6a6b112a8c" UNIQUE ("token"), ` +
      `CONSTRAINT "UQ_9616efcd2c6486fbb02e882af56" UNIQUE ("slug"), ` +
      `CONSTRAINT "FK_4b5bad01d9f4e5a1e15b65024fe" FOREIGN KEY ("formId") REFERENCES "forms" ("id") ON DELETE CASCADE ON UPDATE NO ACTION` +
      `)`
    );
  }

  private readonly columns =
    `"id", "formId", "type", "authMode", "token", "slug", "tags", ` +
    `"customDomain", "expiresAt", "quota", "config", "viewCount", ` +
    `"isActive", "createdAt"`;

  private async rebuild(queryRunner: QueryRunner, check: string) {
    await queryRunner.query(this.table(check));
    await queryRunner.query(
      `INSERT INTO "temporary_publications"(${this.columns}) SELECT ${this.columns} FROM "publications"`,
    );
    await queryRunner.query(`DROP TABLE "publications"`);
    await queryRunner.query(
      `ALTER TABLE "temporary_publications" RENAME TO "publications"`,
    );
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.rebuild(queryRunner, NEW);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    /*
     * برگشت، انتشارهای `staff` را به `none` برمی‌گرداند؛ وگرنه ردیف‌هایی
     * می‌مانند که قیدِ قدیمی نمی‌پذیردشان و بازسازی وسط کار می‌شکند.
     */
    await queryRunner.query(
      `UPDATE "publications" SET "authMode" = 'none' WHERE "authMode" = 'staff'`,
    );
    await this.rebuild(queryRunner, OLD);
  }
}
