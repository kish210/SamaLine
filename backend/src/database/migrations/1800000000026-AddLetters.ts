import { MigrationInterface, QueryRunner } from 'typeorm';

const PRIORITY = `'normal', 'urgent'`;
const KIND = `'to', 'cc'`;

/** نامهٔ داخلی و گیرنده‌هایش (SQLite). */
export class AddLetters1800000000026 implements MigrationInterface {
  name = 'AddLetters1800000000026';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "letters" (` +
        `"id" varchar PRIMARY KEY NOT NULL, ` +
        `"organizationId" varchar NOT NULL, ` +
        `"number" varchar(24) NOT NULL, ` +
        `"subject" varchar(200) NOT NULL, ` +
        `"body" text NOT NULL DEFAULT (''), ` +
        `"senderPersonnelId" varchar NOT NULL, ` +
        `"senderUserId" varchar, ` +
        `"departmentId" varchar, ` +
        `"priority" varchar CHECK( "priority" IN (${PRIORITY}) ) NOT NULL DEFAULT ('normal'), ` +
        `"parentLetterId" varchar, ` +
        `"threadId" varchar NOT NULL, ` +
        `"attachments" text NOT NULL DEFAULT ('[]'), ` +
        `"createdAt" datetime NOT NULL DEFAULT (datetime('now')), ` +
        `"updatedAt" datetime NOT NULL DEFAULT (datetime('now'))` +
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
        `"id" varchar PRIMARY KEY NOT NULL, ` +
        `"organizationId" varchar NOT NULL, ` +
        `"letterId" varchar NOT NULL, ` +
        `"personnelId" varchar NOT NULL, ` +
        `"kind" varchar CHECK( "kind" IN (${KIND}) ) NOT NULL DEFAULT ('to'), ` +
        `"readAt" datetime, ` +
        `"repliedAt" datetime, ` +
        `"createdAt" datetime NOT NULL DEFAULT (datetime('now'))` +
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
    await queryRunner.query(`DROP INDEX "IDX_letter_rcpt_inbox"`);
    await queryRunner.query(`DROP INDEX "IDX_letter_rcpt_unique"`);
    await queryRunner.query(`DROP TABLE "letter_recipients"`);
    await queryRunner.query(`DROP INDEX "IDX_letters_sender"`);
    await queryRunner.query(`DROP INDEX "IDX_letters_thread"`);
    await queryRunner.query(`DROP INDEX "IDX_letters_org_number"`);
    await queryRunner.query(`DROP TABLE "letters"`);
  }
}
