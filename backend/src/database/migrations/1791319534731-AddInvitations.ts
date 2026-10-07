import { MigrationInterface, QueryRunner } from 'typeorm';

/** جدول دعوت‌نامه‌های عضویت در تیم. */
export class AddInvitations1791319534731 implements MigrationInterface {
  name = 'AddInvitations1791319534731';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('invitations')) return;
    await queryRunner.query(
      `CREATE TABLE "invitations" ("id" varchar PRIMARY KEY NOT NULL, "organizationId" varchar NOT NULL, "email" varchar(120) NOT NULL, "role" varchar(20) NOT NULL, "tokenHash" varchar(64) NOT NULL, "invitedBy" varchar NOT NULL, "expiresAt" datetime NOT NULL, "acceptedAt" datetime, "createdAt" datetime NOT NULL DEFAULT (datetime('now')))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b9139f00cebfadced76bca3084" ON "invitations" ("organizationId") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_a6eb6f2543de8a5a4c148b32a1" ON "invitations" ("tokenHash") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_a6eb6f2543de8a5a4c148b32a1"`);
    await queryRunner.query(`DROP INDEX "IDX_b9139f00cebfadced76bca3084"`);
    await queryRunner.query(`DROP TABLE "invitations"`);
  }
}
