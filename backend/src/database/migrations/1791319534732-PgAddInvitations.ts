import { MigrationInterface, QueryRunner } from 'typeorm';

/** جدول دعوت‌نامه‌های عضویت در تیم — گویش Postgres. */
export class PgAddInvitations1791319534732 implements MigrationInterface {
  name = 'PgAddInvitations1791319534732';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "invitations" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "organizationId" uuid NOT NULL, "email" character varying(120) NOT NULL, "role" character varying(20) NOT NULL, "tokenHash" character varying(64) NOT NULL, "invitedBy" uuid NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "acceptedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_invitations_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_b9139f00cebfadced76bca3084" ON "invitations" ("organizationId") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_a6eb6f2543de8a5a4c148b32a1" ON "invitations" ("tokenHash") `,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "invitations"`);
  }
}
