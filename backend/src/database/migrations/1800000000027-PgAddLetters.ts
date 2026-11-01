import { MigrationInterface, QueryRunner } from 'typeorm';

/** نامهٔ داخلی و گیرنده‌هایش (Postgres). */
export class PgAddLetters1800000000027 implements MigrationInterface {
  name = 'PgAddLetters1800000000027';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."letters_priority_enum" AS ENUM('normal', 'urgent')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."letter_recipients_kind_enum" AS ENUM('to', 'cc')`,
    );

    await queryRunner.query(
      `CREATE TABLE "letters" (` +
        `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), ` +
        `"organizationId" uuid NOT NULL, ` +
        `"number" character varying(24) NOT NULL, ` +
        `"subject" character varying(200) NOT NULL, ` +
        `"body" text NOT NULL DEFAULT '', ` +
        `"senderPersonnelId" uuid NOT NULL, ` +
        `"senderUserId" uuid, ` +
        `"departmentId" uuid, ` +
        `"priority" "public"."letters_priority_enum" NOT NULL DEFAULT 'normal', ` +
        `"parentLetterId" uuid, ` +
        `"threadId" uuid NOT NULL, ` +
        `"attachments" jsonb NOT NULL DEFAULT '[]', ` +
        `"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `"updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "PK_letters" PRIMARY KEY ("id")` +
        `)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_letters_org_number" ON "letters" ("organizationId", "number")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_letters_thread" ON "letters" ("threadId", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_letters_sender" ON "letters" ("senderPersonnelId", "createdAt")`,
    );

    await queryRunner.query(
      `CREATE TABLE "letter_recipients" (` +
        `"id" uuid NOT NULL DEFAULT uuid_generate_v4(), ` +
        `"organizationId" uuid NOT NULL, ` +
        `"letterId" uuid NOT NULL, ` +
        `"personnelId" uuid NOT NULL, ` +
        `"kind" "public"."letter_recipients_kind_enum" NOT NULL DEFAULT 'to', ` +
        `"readAt" TIMESTAMP WITH TIME ZONE, ` +
        `"repliedAt" TIMESTAMP WITH TIME ZONE, ` +
        `"createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), ` +
        `CONSTRAINT "PK_letter_recipients" PRIMARY KEY ("id")` +
        `)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_letter_rcpt_unique" ON "letter_recipients" ("letterId", "personnelId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_letter_rcpt_inbox" ON "letter_recipients" ("personnelId", "readAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_letter_rcpt_inbox"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_letter_rcpt_unique"`);
    await queryRunner.query(`DROP TABLE "letter_recipients"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_letters_sender"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_letters_thread"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_letters_org_number"`);
    await queryRunner.query(`DROP TABLE "letters"`);
    await queryRunner.query(
      `DROP TYPE "public"."letter_recipients_kind_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."letters_priority_enum"`);
  }
}
